import logging
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.models import AuditLog, User

logger = logging.getLogger("artisan_ai.audit")

def record_audit_log(
    db: Session,
    actor: Optional[User],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    before_state: Optional[str] = None,
    after_state: Optional[str] = None,
    reason: Optional[str] = None,
    ip_metadata: Optional[str] = None,
    commit: bool = False
) -> Optional[AuditLog]:
    try:
        log_entry = AuditLog(
            actor_id=getattr(actor, "id", None) if actor else None,
            actor_email=getattr(actor, "email", None) if actor else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            before_state=str(before_state) if before_state is not None else None,
            after_state=str(after_state) if after_state is not None else None,
            reason=reason,
            ip_metadata=ip_metadata
        )
        db.add(log_entry)
        if commit:
            db.commit()
            db.refresh(log_entry)
        return log_entry
    except Exception as exc:
        logger.exception("Failed to write audit log for action %s on %s:%s: %s", action, resource_type, resource_id, exc)
        return None
