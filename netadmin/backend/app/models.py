from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now():
    return datetime.utcnow()


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    # router | switch | firewall | ap | server | pc | printer | phone | cloud | other
    kind: Mapped[str] = mapped_column(String(20), default="switch")
    # managed=False -> "machine vide": simple node in the diagram, nothing behind it
    managed: Mapped[bool] = mapped_column(Boolean, default=True)
    discovered: Mapped[bool] = mapped_column(Boolean, default=False)
    driver: Mapped[str] = mapped_column(String(30), default="cisco_ios")
    conn_type: Mapped[str] = mapped_column(String(10), default="ssh")  # ssh | serial | demo
    host: Mapped[str] = mapped_column(String(120), default="")
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)
    username: Mapped[str] = mapped_column(String(80), default="")
    password_enc: Mapped[str] = mapped_column(Text, default="")
    secret_enc: Mapped[str] = mapped_column(Text, default="")
    serial_port: Mapped[str] = mapped_column(String(80), default="")
    baudrate: Mapped[int] = mapped_column(Integer, default=9600)
    ip: Mapped[str] = mapped_column(String(64), default="")  # informative (empty machines)
    mac: Mapped[str] = mapped_column(String(32), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    pos_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    pos_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="unknown")  # unknown | up | down
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    data = relationship("DeviceData", cascade="all, delete-orphan", back_populates="device")
    backups = relationship("Backup", cascade="all, delete-orphan", back_populates="device")


class Link(Base):
    __tablename__ = "links"

    id: Mapped[int] = mapped_column(primary_key=True)
    a_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    b_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    a_port: Mapped[str] = mapped_column(String(60), default="")
    b_port: Mapped[str] = mapped_column(String(60), default="")
    label: Mapped[str] = mapped_column(String(80), default="")
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual | lldp | cdp | mac


class DeviceData(Base):
    """Last snapshot of a `show` family (interfaces, vlans...) fetched from a device."""

    __tablename__ = "device_data"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    device = relationship("Device", back_populates="data")


class Backup(Base):
    __tablename__ = "backups"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    device = relationship("Device", back_populates="backups")


class ChangeLog(Base):
    __tablename__ = "changelog"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    device_name: Mapped[str] = mapped_column(String(80), default="")
    commands: Mapped[str] = mapped_column(Text, default="")
    output: Mapped[str] = mapped_column(Text, default="")
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
