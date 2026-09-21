"""
Delivery Address API — /api/marketplace/addresses
Authenticated buyers can save, list, update, delete, and set default addresses.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Address, User
from backend.app.schemas import AddressCreate, AddressUpdate, AddressResponse
from backend.app.services.auth import require_buyer

router = APIRouter(prefix="/api/marketplace/addresses", tags=["Delivery Addresses"])


@router.get("", response_model=List[AddressResponse])
def list_addresses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_buyer),
):
    """Return all saved delivery addresses for the logged-in buyer."""
    return (
        db.query(Address)
        .filter(Address.user_id == current_user.id)
        .order_by(Address.is_default.desc(), Address.id.desc())
        .all()
    )


@router.post("", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_buyer),
):
    """Save a new delivery address for the logged-in buyer."""
    # If this is marked default, unset all existing defaults first
    if payload.is_default:
        db.query(Address).filter(
            Address.user_id == current_user.id
        ).update({"is_default": False})

    # If first address ever, auto-make it default
    existing_count = db.query(Address).filter(Address.user_id == current_user.id).count()
    is_default = payload.is_default or existing_count == 0

    addr = Address(
        user_id=current_user.id,
        name=payload.name,
        phone=payload.phone,
        pincode=payload.pincode,
        address_line=payload.address_line,
        city=payload.city,
        state=payload.state,
        tag=(payload.tag or "HOME").upper(),
        is_default=is_default,
    )
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return addr


@router.put("/{address_id}", response_model=AddressResponse)
def update_address(
    address_id: int,
    payload: AddressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_buyer),
):
    """Update an existing delivery address."""
    addr = db.query(Address).filter(
        Address.id == address_id, Address.user_id == current_user.id
    ).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")

    if payload.name is not None:
        addr.name = payload.name
    if payload.phone is not None:
        addr.phone = payload.phone
    if payload.pincode is not None:
        addr.pincode = payload.pincode
    if payload.address_line is not None:
        addr.address_line = payload.address_line
    if payload.city is not None:
        addr.city = payload.city
    if payload.state is not None:
        addr.state = payload.state
    if payload.tag is not None:
        addr.tag = payload.tag.upper()
    if payload.is_default is True:
        # Unset default on all other addresses
        db.query(Address).filter(
            Address.user_id == current_user.id,
            Address.id != address_id,
        ).update({"is_default": False})
        addr.is_default = True

    db.commit()
    db.refresh(addr)
    return addr


@router.post("/{address_id}/default", response_model=AddressResponse)
def set_default_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_buyer),
):
    """Set an address as the default delivery address."""
    addr = db.query(Address).filter(
        Address.id == address_id, Address.user_id == current_user.id
    ).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")

    db.query(Address).filter(Address.user_id == current_user.id).update({"is_default": False})
    addr.is_default = True
    db.commit()
    db.refresh(addr)
    return addr


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_buyer),
):
    """Delete a saved delivery address."""
    addr = db.query(Address).filter(
        Address.id == address_id, Address.user_id == current_user.id
    ).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")

    was_default = addr.is_default
    db.delete(addr)
    db.commit()

    # If deleted address was default, promote the most recent remaining one
    if was_default:
        next_addr = (
            db.query(Address)
            .filter(Address.user_id == current_user.id)
            .order_by(Address.id.desc())
            .first()
        )
        if next_addr:
            next_addr.is_default = True
            db.commit()
