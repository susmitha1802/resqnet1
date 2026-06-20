"""
ResQNet — SQLAlchemy Models (SQLAlchemy 2.0 typed declarative style)
Explicit __init__ methods on every model silence Pylance's
"Unexpected keyword argument" false-positives permanently.
"""
from __future__ import annotations
from datetime import datetime, timezone
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
    role:         Mapped[str]            = mapped_column(Enum('victim', 'volunteer', 'ngo', 'admin', name='user_role'), default='victim')
    skills:       Mapped[Optional[str]]  = mapped_column(Text)
    location:     Mapped[Optional[str]]  = mapped_column(String(200))
    availability: Mapped[str]            = mapped_column(Enum('available', 'unavailable', name='user_availability'), default='available')
    created_at:   Mapped[datetime]       = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at:   Mapped[datetime]       = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    disaster_type: Mapped[str]           = mapped_column(Enum('Flood', 'Cyclone', 'Earthquake', 'Landslide', 'Fire', name='disaster_type_enum'), nullable=False)
    description:   Mapped[str]           = mapped_column(Text, nullable=False)
    image_path:    Mapped[Optional[str]] = mapped_column(String(500))
    severity:      Mapped[str]           = mapped_column(Enum('Low Damage', 'Moderate Damage', 'Severe Damage', name='severity_enum'), default='Moderate Damage')
    latitude:      Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    longitude:     Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    created_at:    Mapped[datetime]      = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

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
            'user_name':     self.user.name if self.user_id else None,
        }


# ── HelpRequest ────────────────────────────────────────────────────────────────

class HelpRequest(db.Model):
    __tablename__ = 'help_requests'

    request_id:       Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:          Mapped[int]           = mapped_column(Integer, ForeignKey('users.user_id'), nullable=False)
    name:             Mapped[str]           = mapped_column(String(120), nullable=False)
    contact:          Mapped[str]           = mapped_column(String(20),  nullable=False)
    request_type:     Mapped[str]           = mapped_column(Enum('Food', 'Water', 'Medicine', 'Rescue', 'Shelter', name='request_type_enum'), nullable=False)
    priority_level:   Mapped[str]           = mapped_column(Enum('High', 'Medium', 'Low', name='priority_level_enum'), nullable=False, default='Medium')
    number_of_people: Mapped[int]           = mapped_column(Integer, nullable=False, default=1)
    description:      Mapped[Optional[str]] = mapped_column(Text)
    image_path:       Mapped[Optional[str]] = mapped_column(String(500))
    is_duplicate:     Mapped[bool]          = mapped_column(Boolean, default=False)
    status:           Mapped[str]           = mapped_column(Enum('Pending', 'Accepted', 'En Route', 'On Site', 'Completed', 'Duplicate', name='help_request_status'), default='Pending')
    latitude:         Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    longitude:        Mapped[Decimal]       = mapped_column(Numeric(10, 6), nullable=False)
    created_at:       Mapped[datetime]      = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at:       Mapped[datetime]      = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
        tasks_list = self.tasks.all()  # type: ignore
        tasks_list.sort(key=lambda t: t.assigned_at, reverse=True)
        latest_task = tasks_list[0] if tasks_list else None
        assigned_vol_name = latest_task.volunteer.user.name if latest_task and latest_task.volunteer and latest_task.volunteer.user else None

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
            'assigned_volunteer': assigned_vol_name,
        }


# ── Volunteer ──────────────────────────────────────────────────────────────────

class Volunteer(db.Model):
    __tablename__ = 'volunteers'

    volunteer_id:        Mapped[int]               = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:             Mapped[int]               = mapped_column(Integer, ForeignKey('users.user_id'), nullable=False, unique=True)
    availability_status: Mapped[str]               = mapped_column(Enum('available', 'unavailable', 'on_task', name='volunteer_status'), default='available')
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
            'user_name':           self.user.name if self.user_id else None,
        }


# ── ReliefTask ─────────────────────────────────────────────────────────────────

class ReliefTask(db.Model):
    __tablename__ = 'relief_tasks'

    task_id:              Mapped[int]                = mapped_column(Integer, primary_key=True, autoincrement=True)
    volunteer_id:         Mapped[int]                = mapped_column(Integer, ForeignKey('volunteers.volunteer_id'), nullable=False)
    request_id:           Mapped[int]                = mapped_column(Integer, ForeignKey('help_requests.request_id'), nullable=False)
    status:               Mapped[str]                = mapped_column(Enum('Assigned', 'En Route', 'On Site', 'Proof Submitted', 'Completed', 'Cancelled', name='relief_task_status'), default='Assigned')
    assigned_at:          Mapped[datetime]           = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at:         Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Verification fields
    proof_image_path:     Mapped[Optional[str]]      = mapped_column(String(255))
    completion_notes:     Mapped[Optional[str]]      = mapped_column(Text)
    verification_status:  Mapped[str]                = mapped_column(Enum('Pending', 'Approved', 'Rejected', name='task_verification_status'), default='Pending')
    verified_by_admin_id: Mapped[Optional[int]]      = mapped_column(Integer, ForeignKey('users.user_id'))

    volunteer: Mapped[Volunteer]   = relationship('Volunteer',   back_populates='tasks')
    request:   Mapped[HelpRequest] = relationship('HelpRequest', back_populates='tasks')

    def __init__(
        self,
        volunteer_id:         int,
        request_id:           int,
        status:               str = 'Assigned',
        proof_image_path:     Optional[str] = None,
        completion_notes:     Optional[str] = None,
        verification_status:  str = 'Pending',
        verified_by_admin_id: Optional[int] = None,
    ) -> None:
        self.volunteer_id         = volunteer_id
        self.request_id           = request_id
        self.status               = status
        self.proof_image_path     = proof_image_path
        self.completion_notes     = completion_notes
        self.verification_status  = verification_status
        self.verified_by_admin_id = verified_by_admin_id

    def to_dict(self) -> dict:
        return {
            'task_id':              self.task_id,
            'volunteer_id':         self.volunteer_id,
            'request_id':           self.request_id,
            'status':               self.status,
            'proof_image_path':     self.proof_image_path,
            'completion_notes':     self.completion_notes,
            'verification_status':  self.verification_status,
            'verified_by_admin_id': self.verified_by_admin_id,
            'assigned_at':          self.assigned_at.isoformat() if self.assigned_at else None,
            'completed_at':         self.completed_at.isoformat() if self.completed_at else None,
        }

# ── Contact Message ────────────────────────────────────────────────────────────

class ContactMessage(db.Model):
    __tablename__ = 'contact_messages'

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:       Mapped[str]      = mapped_column(String(100), nullable=False)
    email:      Mapped[str]      = mapped_column(String(120), nullable=False)
    subject:    Mapped[str]      = mapped_column(String(200), nullable=False)
    message:    Mapped[str]      = mapped_column(Text, nullable=False)
    status:     Mapped[str]      = mapped_column(Enum('Unread', 'Read', 'Replied', name='contact_status_enum'), default='Unread')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __init__(
        self,
        name:    str,
        email:   str,
        subject: str,
        message: str,
        status:  str = 'Unread',
    ) -> None:
        self.name    = name
        self.email   = email
        self.subject = subject
        self.message = message
        self.status  = status

    def to_dict(self) -> dict:
        return {
            'id':         self.id,
            'name':       self.name,
            'email':      self.email,
            'subject':    self.subject,
            'message':    self.message,
            'status':     self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
