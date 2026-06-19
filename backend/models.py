"""
ResQNet — SQLAlchemy Models (SQLAlchemy 2.0 typed declarative style)
Explicit __init__ methods on every model silence Pylance's
"Unexpected keyword argument" false-positives permanently.
"""
from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from extensions import db  # db.Model inherits from typed DeclarativeBase


# ── User ───────────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'

    user_id:      Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:         Mapped[str]            = mapped_column(String(120), nullable=False)
    email:        Mapped[str]            = mapped_column(String(150), nullable=False, unique=True)
    phone:        Mapped[str]            = mapped_column(String(20),  nullable=False)
    password:     Mapped[str]            = mapped_column(String(255), nullable=False)
    role:         Mapped[str]            = mapped_column(Enum('victim', 'volunteer', 'ngo', 'admin'), default='victim')
    skills:       Mapped[Optional[str]]  = mapped_column(Text)
    location:     Mapped[Optional[str]]  = mapped_column(String(200))
    availability: Mapped[str]            = mapped_column(Enum('available', 'unavailable'), default='available')
    created_at:   Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:   Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reports:   Mapped[list[DisasterReport]] = relationship('DisasterReport', back_populates='user', lazy='dynamic')
    requests:  Mapped[list[HelpRequest]]    = relationship('HelpRequest',    back_populates='user', lazy='dynamic')
    volunteer: Mapped[Optional[Volunteer]]  = relationship('Volunteer',      back_populates='user', uselist=False)

    def __init__(
        self,
        name:         str,
        email:        str,
        phone:        str,
        password:     str,
        role:         str = 'victim',
        skills:       Optional[str] = None,
        location:     Optional[str] = None,
        availability: str = 'available',
    ) -> None:
        self.name         = name
        self.email        = email
        self.phone        = phone
        self.password     = password
        self.role         = role
        self.skills       = skills
        self.location     = location
        self.availability = availability

    def to_dict(self) -> dict:
        return {
            'user_id':      self.user_id,
            'name':         self.name,
            'email':        self.email,
            'phone':        self.phone,
            'role':         self.role,
            'skills':       self.skills,
            'location':     self.location,
            'availability': self.availability,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


# ── DisasterReport ─────────────────────────────────────────────────────────────

class DisasterReport(db.Model):
    __tablename__ = 'disaster_reports'

    report_id:     Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:       Mapped[int]           = mapped_column(Integer, ForeignKey('users.user_id'), nullable=False)
    disaster_type: Mapped[str]           = mapped_column(Enum('Flood', 'Cyclone', 'Earthquake', 'Landslide', 'Fire'), nullable=False)
    description:   Mapped[str]           = mapped_column(Text, nullable=False)
    image_path:    Mapped[Optional[str]] = mapped_column(String(500))
    severity:      Mapped[str]           = mapped_column(Enum('Low Damage', 'Moderate Damage', 'Severe Damage'), default='Moderate Damage')
    latitude:      Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    longitude:     Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    created_at:    Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship('User', back_populates='reports')

    def __init__(
        self,
        user_id:       int,
        disaster_type: str,
        description:   str,
        latitude:      float,
        longitude:     float,
        image_path:    Optional[str] = None,
        severity:      str = 'Moderate Damage',
    ) -> None:
        self.user_id       = user_id
        self.disaster_type = disaster_type
        self.description   = description
        self.latitude      = Decimal(str(latitude))
        self.longitude     = Decimal(str(longitude))
        self.image_path    = image_path
        self.severity      = severity

    def to_dict(self) -> dict:
        return {
            'report_id':     self.report_id,
            'user_id':       self.user_id,
            'disaster_type': self.disaster_type,
            'description':   self.description,
            'image_path':    self.image_path,
            'severity':      self.severity,
            'latitude':      float(self.latitude),
            'longitude':     float(self.longitude),
            'created_at':    self.created_at.isoformat() if self.created_at else None,
            'user_name':     self.user.name if self.user else None,
        }


# ── HelpRequest ────────────────────────────────────────────────────────────────

class HelpRequest(db.Model):
    __tablename__ = 'help_requests'

    request_id:       Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:          Mapped[int]           = mapped_column(Integer, ForeignKey('users.user_id'), nullable=False)
    name:             Mapped[str]           = mapped_column(String(120), nullable=False)
    contact:          Mapped[str]           = mapped_column(String(20),  nullable=False)
    request_type:     Mapped[str]           = mapped_column(Enum('Food', 'Water', 'Medicine', 'Rescue', 'Shelter'), nullable=False)
    priority_level:   Mapped[str]           = mapped_column(Enum('High', 'Medium', 'Low'), nullable=False, default='Medium')
    number_of_people: Mapped[int]           = mapped_column(Integer, nullable=False, default=1)
    description:      Mapped[Optional[str]] = mapped_column(Text)
    image_path:       Mapped[Optional[str]] = mapped_column(String(500))
    is_duplicate:     Mapped[bool]          = mapped_column(Boolean, default=False)
    status:           Mapped[str]           = mapped_column(Enum('Pending', 'Accepted', 'En Route', 'On Site', 'Completed', 'Duplicate'), default='Pending')
    latitude:         Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    longitude:        Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    created_at:       Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:       Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user:  Mapped[User]             = relationship('User',       back_populates='requests')
    tasks: Mapped[list[ReliefTask]] = relationship('ReliefTask', back_populates='request', lazy='dynamic')

    def __init__(
        self,
        user_id:          int,
        name:             str,
        contact:          str,
        request_type:     str,
        latitude:         float,
        longitude:        float,
        priority_level:   str = 'Medium',
        number_of_people: int = 1,
        description:      Optional[str] = None,
        image_path:       Optional[str] = None,
        is_duplicate:     bool = False,
        status:           str = 'Pending',
    ) -> None:
        self.user_id          = user_id
        self.name             = name
        self.contact          = contact
        self.request_type     = request_type
        self.latitude         = Decimal(str(latitude))
        self.longitude        = Decimal(str(longitude))
        self.priority_level   = priority_level
        self.number_of_people = number_of_people
        self.description      = description
        self.image_path       = image_path
        self.is_duplicate     = is_duplicate
        self.status           = status

    def to_dict(self) -> dict:
        return {
            'request_id':       self.request_id,
            'user_id':          self.user_id,
            'name':             self.name,
            'contact':          self.contact,
            'request_type':     self.request_type,
            'priority_level':   self.priority_level,
            'number_of_people': self.number_of_people,
            'description':      self.description,
            'image_path':       self.image_path,
            'is_duplicate':     self.is_duplicate,
            'status':           self.status,
            'latitude':         float(self.latitude),
            'longitude':        float(self.longitude),
            'created_at':       self.created_at.isoformat() if self.created_at else None,
            'updated_at':       self.updated_at.isoformat() if self.updated_at else None,
        }


# ── Volunteer ──────────────────────────────────────────────────────────────────

class Volunteer(db.Model):
    __tablename__ = 'volunteers'

    volunteer_id:        Mapped[int]               = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:             Mapped[int]               = mapped_column(Integer, ForeignKey('users.user_id'), nullable=False, unique=True)
    availability_status: Mapped[str]               = mapped_column(Enum('available', 'unavailable', 'on_task'), default='available')
    assigned_tasks:      Mapped[int]               = mapped_column(Integer, default=0)
    completed_tasks:     Mapped[int]               = mapped_column(Integer, default=0)
    rating:              Mapped[Optional[Decimal]]  = mapped_column(Numeric(3, 2), default=5.00)
    last_location_lat:   Mapped[Optional[Decimal]]  = mapped_column(Numeric(10, 6))
    last_location_lng:   Mapped[Optional[Decimal]]  = mapped_column(Numeric(10, 6))

    user:  Mapped[User]             = relationship('User',       back_populates='volunteer')
    tasks: Mapped[list[ReliefTask]] = relationship('ReliefTask', back_populates='volunteer', lazy='dynamic')

    def __init__(
        self,
        user_id:             int,
        availability_status: str = 'available',
        assigned_tasks:      int = 0,
        completed_tasks:     int = 0,
    ) -> None:
        self.user_id             = user_id
        self.availability_status = availability_status
        self.assigned_tasks      = assigned_tasks
        self.completed_tasks     = completed_tasks

    def to_dict(self) -> dict:
        return {
            'volunteer_id':        self.volunteer_id,
            'user_id':             self.user_id,
            'availability_status': self.availability_status,
            'assigned_tasks':      self.assigned_tasks,
            'completed_tasks':     self.completed_tasks,
            'rating':              float(self.rating) if self.rating else 5.0,
            'user_name':           self.user.name if self.user else None,
        }


# ── ReliefTask ─────────────────────────────────────────────────────────────────

class ReliefTask(db.Model):
    __tablename__ = 'relief_tasks'

    task_id:      Mapped[int]               = mapped_column(Integer, primary_key=True, autoincrement=True)
    volunteer_id: Mapped[int]               = mapped_column(Integer, ForeignKey('volunteers.volunteer_id'), nullable=False)
    request_id:   Mapped[int]               = mapped_column(Integer, ForeignKey('help_requests.request_id'), nullable=False)
    status:       Mapped[str]               = mapped_column(Enum('Assigned', 'En Route', 'On Site', 'Completed', 'Cancelled'), default='Assigned')
    assigned_at:  Mapped[datetime]          = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    notes:        Mapped[Optional[str]]     = mapped_column(Text)

    volunteer: Mapped[Volunteer]   = relationship('Volunteer',   back_populates='tasks')
    request:   Mapped[HelpRequest] = relationship('HelpRequest', back_populates='tasks')

    def __init__(
        self,
        volunteer_id: int,
        request_id:   int,
        status:       str = 'Assigned',
        notes:        Optional[str] = None,
    ) -> None:
        self.volunteer_id = volunteer_id
        self.request_id   = request_id
        self.status       = status
        self.notes        = notes

    def to_dict(self) -> dict:
        return {
            'task_id':      self.task_id,
            'volunteer_id': self.volunteer_id,
            'request_id':   self.request_id,
            'status':       self.status,
            'assigned_at':  self.assigned_at.isoformat() if self.assigned_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
