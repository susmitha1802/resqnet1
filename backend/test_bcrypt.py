import bcrypt

hashed = b"$2b$12$gprKIFBWxWSJtz9xm0iqaOqRMdI8OrxD21MDTUSbYHt3IX6M6eWaW"
password = b"demo123"

try:
    res = bcrypt.checkpw(password, hashed)
    print("Match:", res)
except Exception as e:
    print("Error:", e)
