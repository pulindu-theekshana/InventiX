"""
Try learning a barcode

Purpose : Proves the scan-to-link endpoint against the real project: a code is saved to a product, the same code twice is not a failure, a second code for one product is refused, another shop cannot claim a code that is taken, and nobody can write to someone else's stock item. Puts the catalog back afterwards.
Spec    : Section 6.6
Look here when : A scanned code will not save, or saves to the wrong product.

Run from backend/:
    .venv\\Scripts\\python.exe scripts\try_barcode_learning.py
"""
import sys
from types import SimpleNamespace

sys.path.insert(0, '.')

from fastapi.testclient import TestClient

from app import dependencies
from app.core.supabase import service_client
from app.main import app

db = service_client()
owner = db.table('profiles').select('id, business_name, contact_person, email').eq(
    'role', 'customer').eq('business_name', 'Wasantha Kade').limit(1).execute().data[0]

item = db.table('stock_items').select('id, catalog_product_id, product_catalog!inner(name, barcode)').eq(
    'owner_id', owner['id']).limit(1).execute().data[0]
print('product:', item['product_catalog']['name'], '| barcode now:', item['product_catalog']['barcode'])

other_shop = db.table('profiles').select('id').eq('role', 'customer').neq(
    'id', owner['id']).limit(1).execute().data[0]
other_item = db.table('stock_items').select('id').eq('owner_id', other_shop['id']).limit(1).execute().data

def as_user(profile_id, shop_id):
    return SimpleNamespace(
        id=profile_id, role='customer', business_name='x', contact_person='x',
        email='x@y.lk', access_token='probe', shop_id=shop_id, is_cashier=False, db=db,
    )

app.dependency_overrides[dependencies.get_current_user] = lambda: as_user(owner['id'], owner['id'])
client = TestClient(app, raise_server_exceptions=False)

CODE = '4791234567890'
try:
    r = client.post(f"/customer/stocks/{item['id']}/barcode", json={'barcode': CODE})
    print('save a new barcode ->', r.status_code, '(want 204)')

    saved = db.table('product_catalog').select('barcode').eq(
        'id', item['catalog_product_id']).single().execute().data['barcode']
    print('stored:', saved, '(want', CODE + ')')

    again = client.post(f"/customer/stocks/{item['id']}/barcode", json={'barcode': CODE})
    print('same code, same product ->', again.status_code, '(want 204, saying it again is not a failure)')

    different = client.post(f"/customer/stocks/{item['id']}/barcode", json={'barcode': '9999999999999'})
    print('a second code for one product ->', different.status_code, different.json().get('detail', '')[:70])

    if other_item:
        app.dependency_overrides[dependencies.get_current_user] = lambda: as_user(
            other_shop['id'], other_shop['id'])
        taken = client.post(f"/customer/stocks/{other_item[0]['id']}/barcode", json={'barcode': CODE})
        print('another shop claiming that code ->', taken.status_code, taken.json().get('detail', '')[:70])

        app.dependency_overrides[dependencies.get_current_user] = lambda: as_user(
            other_shop['id'], other_shop['id'])
        theirs = client.post(f"/customer/stocks/{item['id']}/barcode", json={'barcode': '1234567890'})
        print("someone else's stock item ->", theirs.status_code, '(want 404)')

    bad = client.post(f"/customer/stocks/{item['id']}/barcode", json={'barcode': 'no'})
    print('too short to be a barcode ->', bad.status_code, '(want 422)')
finally:
    service_client().table('product_catalog').update({'barcode': item['product_catalog']['barcode']}).eq(
        'id', item['catalog_product_id']).execute()
    back = db.table('product_catalog').select('barcode').eq(
        'id', item['catalog_product_id']).single().execute().data['barcode']
    print('catalog put back, barcode is', back)
