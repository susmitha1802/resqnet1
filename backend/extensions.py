"""
ResQNet — Flask Extensions (shared instances)

Uses Flask-SQLAlchemy 3.x recommended pattern:
  - DeclarativeBase subclass as model_class gives Pylance/Pyright
    full type visibility into all model constructors and attributes.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Typed declarative base — enables Pylance to resolve model constructors."""
    pass


db  = SQLAlchemy(model_class=Base)
jwt = JWTManager()
