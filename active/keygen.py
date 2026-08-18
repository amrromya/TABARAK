"""
╔══════════════════════════════════════════════════════════════╗
║        أداة توليد أكواد التفعيل - برنامج تبارك              ║
║        Tabarak License Key Generator                         ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import sys
import json
import hashlib
import base64
from datetime import datetime, timedelta


LICENSES_FILE = "licenses.json"
SECRET_KEY = "t4b4r4k_s3cr3t_k3y_2025!"


def compute_checksum(license_data):
    """حساب التوقيع HMAC"""
    payload = "{}|{}|{}|{}|{}".format(
        license_data["hwid"],
        license_data["customer_name"],
        license_data["expiry_date"],
        license_data["features"],
        license_data["created_at"]
    )
    combined = "{}|{}".format(payload, SECRET_KEY)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def generate_license(customer_name, hwid, expiry_date, features="full"):
    """توليد كود تفعيل"""
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    license_data = {
        "hwid": hwid.strip().upper(),
        "customer_name": customer_name.strip(),
        "expiry_date": expiry_date,
        "features": features,
        "created_at": created_at,
        "checksum": ""
    }

    license_data["checksum"] = compute_checksum(license_data)

    # إنشاء الكود
    data_json = json.dumps(license_data, separators=(",", ":"), ensure_ascii=False)
    encoded = base64.urlsafe_b64encode(data_json.encode("utf-8")).decode("utf-8")

    # تقسيم إلى أجزاء مقروءة
    parts = [encoded[i:i+8] for i in range(0, len(encoded), 8)]
    code = "TABARAK-" + "-".join(parts[:6])

    return code, license_data


def decode_license_code(license_key):
    """فك تشفير كود التفعيل"""
    try:
        key = license_key.replace("TABARAK-", "")
        encoded = key.replace("-", "")

        padding = 4 - (len(encoded) % 4)
        if padding != 4:
            encoded += "=" * padding

        data_str = base64.urlsafe_b64decode(encoded).decode("utf-8")
        return json.loads(data_str)
    except Exception:
        return None


def verify_license(license_data):
    """التحقق من صلاحية التفعيل"""
    # التحقق من التوقيع
    expected = compute_checksum(license_data)
    if expected != license_data.get("checksum", ""):
        return False, "توقيع غير صالح"

    # التحقق من تاريخ الانتهاء
    try:
        expiry = datetime.strptime(license_data["expiry_date"], "%Y-%m-%d")
        if datetime.now() > expiry:
            return False, "انتهت الصلاحية"
    except ValueError:
        return False, "تاريخ غير صالح"

    return True, "صالح"


def save_license_record(license_data, license_key):
    """حفظ سجل التفعيل"""
    records = []
    if os.path.exists(LICENSES_FILE):
        with open(LICENSES_FILE, "r", encoding="utf-8") as f:
            records = json.load(f)

    record = {
        "key": license_key,
        "customer": license_data["customer_name"],
        "hwid": license_data["hwid"],
        "expiry": license_data["expiry_date"],
        "features": license_data["features"],
        "created": license_data["created_at"]
    }
    records.append(record)

    with open(LICENSES_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


def list_licenses():
    """عرض جميع أكواد التفعيل"""
    if not os.path.exists(LICENSES_FILE):
        print("  لا توجد أكواد تفعيل محفوظة")
        return

    with open(LICENSES_FILE, "r", encoding="utf-8") as f:
        records = json.load(f)

    if not records:
        print("  لا توجد أكواد تفعيل محفوظة")
        return

    print("\n  عدد أكواد التفعيل: {}".format(len(records)))
    print("=" * 60)

    for i, rec in enumerate(records, 1):
        print("\n#{}".format(i))
        print("   العميل: {}".format(rec['customer']))
        print("   الكود: {}".format(rec['key']))
        print("   الجهاز: {}".format(rec['hwid']))
        print("   الانتهاء: {}".format(rec['expiry']))
        print("   الميزات: {}".format(rec['features']))

    print("\n" + "=" * 60)


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║        أداة توليد أكواد التفعيل - برنامج تبارك              ║
╚══════════════════════════════════════════════════════════════╝
    """)

    while True:
        print("\n  القائمة الرئيسية:")
        print("   1  توليد كود تفعيل جديد")
        print("   2  عرض أكواد التفعيل المحفوظة")
        print("   3  التحقق من كود تفعيل")
        print("   4  خروج")

        choice = input("\n  اختر رقم: ").strip()

        if choice == "1":
            print("\n  بيانات التفعيل:")
            customer_name = input("   اسم العميل: ").strip()
            hwid = input("   بصمة الجهاز (HWID): ").strip()

            print("\n   مدة الصلاحية:")
            print("   1  شهر واحد")
            print("   2  3 أشهر")
            print("   3  6 أشهر")
            print("   4  سنة كاملة")
            print("   5  مدى الحياة")

            duration = input("   اختر: ").strip()

            if duration == "1":
                expiry = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
            elif duration == "2":
                expiry = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")
            elif duration == "3":
                expiry = (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")
            elif duration == "4":
                expiry = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
            elif duration == "5":
                expiry = "2099-12-31"
            else:
                expiry = input("   أدخل تاريخ الانتهاء (YYYY-MM-DD): ").strip()

            print("\n   الميزات:")
            print("   1  basic - مخزون + مبيعات")
            print("   2  pro - + تقارير + صيانة")
            print("   3  full - كل شيء")

            features = input("   اختر: ").strip()
            features_map = {"1": "basic", "2": "pro", "3": "full"}
            features = features_map.get(features, "full")

            # توليد الكود
            print("\n  جارٍ توليد كود التفعيل...")
            license_key, license_data = generate_license(
                customer_name, hwid, expiry, features
            )

            # حفظ السجل
            save_license_record(license_data, license_key)

            print("\n" + "=" * 60)
            print("  تم توليد كود التفعيل بنجاح!")
            print("=" * 60)
            print("\n  كود التفعيل:")
            print("  {}".format(license_key))
            print("\n  العميل: {}".format(customer_name))
            print("  الجهاز: {}".format(hwid))
            print("  الانتهاء: {}".format(expiry))
            print("  الميزات: {}".format(features))
            print("\n" + "=" * 60)

        elif choice == "2":
            list_licenses()

        elif choice == "3":
            key = input("\n  أدخل كود التفعيل: ").strip()
            license_data = decode_license_code(key)

            if license_data:
                valid, msg = verify_license(license_data)
                if valid:
                    print("\n  كود التفعيل صالح")
                    print("   العميل: {}".format(license_data['customer_name']))
                    print("   الجهاز: {}".format(license_data['hwid']))
                    print("   الانتهاء: {}".format(license_data['expiry_date']))
                else:
                    print("\n  كود التفعيل غير صالح: {}".format(msg))
            else:
                print("\n  فشل فك تشفير الكود")

        elif choice == "4":
            print("\n  شكراً لاستخدام أداة التفعيل")
            break

        else:
            print("\n  خيار غير صالح")


if __name__ == "__main__":
    main()
