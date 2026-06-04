"""Desktop-mode API endpoints: bootstrap, assistant CRUD, identity."""
import os
import uuid

from fastapi import APIRouter, HTTPException

from core.database import SessionLocal
from core.security import create_access_token
from models.user import User
from models.group import Group, GroupPermission
from models.user_group import UserGroup
from repositories import PermissionGroupRepository, RoleRepository, UserRepository
from services.auth_service import auth_service

router = APIRouter(prefix='/desktop', tags=['desktop'])

DEFAULT_ASSISTANT = {
    'username': 'astronomer',
    'display_name': '天文学家',
    'avatar': '🪐',
    'description': (
        '天文学家是一位专注于太阳系、行星、卫星、小行星、彗星和基础天文知识的入门向导，'
        '擅长用清晰、耐心、富有画面感的方式解释宇宙中的常见现象，'
        '帮助用户从太阳系开始建立对天文学的整体认识。'
    ),
}

DESKTOP_GROUP_NAME = 'desktop-default'
DESKTOP_TENANT_ID = 'desktop'


def _is_desktop_mode() -> bool:
    return os.environ.get('LAZYMIND_DESKTOP_MODE', '').lower() in ('true', '1', 'yes')


def _user_to_assistant(user: User) -> dict:
    return {
        'id': str(user.id),
        'username': user.username,
        'displayName': user.display_name or user.username,
        'avatar': user.remark or '🤖',
        'description': user.phone or '',
        'createdAt': user.created_at.isoformat() if user.created_at else '',
    }


def _parse_assistant_id(assistant_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(assistant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='invalid assistant id') from exc


def _ensure_desktop_bootstrap(db):
    user_role = RoleRepository.get_by_name(db, 'user')
    if not user_role:
        user_role = RoleRepository.create(db, 'user', built_in=True)

    group = db.query(Group).filter_by(
        group_name=DESKTOP_GROUP_NAME,
        tenant_id=DESKTOP_TENANT_ID,
    ).first()
    if not group:
        group = Group(
            tenant_id=DESKTOP_TENANT_ID,
            group_name=DESKTOP_GROUP_NAME,
            remark='Default desktop group with full permissions',
        )
        db.add(group)
        db.flush()

        all_pgs = PermissionGroupRepository.list_all_ordered(db)
        for pg in all_pgs:
            db.add(GroupPermission(group_id=group.id, permission_group_id=pg.id))
        db.commit()

    assistant_user = UserRepository.get_by_username(db, DEFAULT_ASSISTANT['username'])
    if not assistant_user:
        assistant_user = User(
            username=DEFAULT_ASSISTANT['username'],
            display_name=DEFAULT_ASSISTANT['display_name'],
            password_hash=auth_service.hash_password('desktop-assistant'),
            role_id=user_role.id,
            tenant_id=DESKTOP_TENANT_ID,
            remark=DEFAULT_ASSISTANT['avatar'],
            phone=DEFAULT_ASSISTANT['description'],
            source='desktop',
        )
        db.add(assistant_user)
        db.flush()

        db.add(UserGroup(
            tenant_id=DESKTOP_TENANT_ID,
            user_id=assistant_user.id,
            group_id=group.id,
        ))
        db.commit()
    elif assistant_user.disabled:
        assistant_user.disabled = False
        db.commit()

    return assistant_user, group, user_role


@router.post('/bootstrap')
def desktop_bootstrap():
    """Idempotent first-launch initialization: creates default group and default AI assistant."""
    with SessionLocal() as db:
        assistant_user, _, _ = _ensure_desktop_bootstrap(db)
        return {'defaultAssistant': _user_to_assistant(assistant_user)}


@router.get('/assistants')
def list_assistants():
    """List all AI assistants (desktop-sourced users)."""
    with SessionLocal() as db:
        users = db.query(User).filter(
            User.source == 'desktop',
            User.disabled == False,
            User.tenant_id == DESKTOP_TENANT_ID,
        ).order_by(User.created_at).all()
        return {'assistants': [_user_to_assistant(u) for u in users]}


@router.post('/assistants')
def create_assistant(body: dict):
    """Create a new AI assistant."""
    username = (body.get('username') or '').strip()
    display_name = (body.get('displayName') or '').strip()
    avatar = (body.get('avatar') or '🤖').strip()
    description = (body.get('description') or '').strip()

    if not username:
        raise HTTPException(status_code=400, detail='username is required')

    with SessionLocal() as db:
        _, group, user_role = _ensure_desktop_bootstrap(db)
        if UserRepository.get_by_username(db, username):
            raise HTTPException(status_code=409, detail='username already exists')

        user = User(
            username=username,
            display_name=display_name,
            password_hash=auth_service.hash_password('desktop-assistant'),
            role_id=user_role.id,
            tenant_id=DESKTOP_TENANT_ID,
            remark=avatar,
            phone=description,
            source='desktop',
        )
        db.add(user)
        db.flush()

        if group:
            db.add(UserGroup(
                tenant_id=DESKTOP_TENANT_ID,
                user_id=user.id,
                group_id=group.id,
            ))
        db.commit()

        return {'assistant': _user_to_assistant(user)}


@router.get('/assistants/{assistant_id}')
def get_assistant(assistant_id: str):
    """Get a single assistant by ID."""
    parsed_id = _parse_assistant_id(assistant_id)
    with SessionLocal() as db:
        user = db.query(User).filter_by(id=parsed_id).first()
        if not user or user.source != 'desktop' or user.disabled:
            raise HTTPException(status_code=404, detail='assistant not found')
        return {'assistant': _user_to_assistant(user)}


@router.patch('/assistants/{assistant_id}')
def update_assistant(assistant_id: str, body: dict):
    """Update assistant displayName, avatar, or description."""
    parsed_id = _parse_assistant_id(assistant_id)
    with SessionLocal() as db:
        user = db.query(User).filter_by(id=parsed_id).first()
        if not user or user.source != 'desktop' or user.disabled:
            raise HTTPException(status_code=404, detail='assistant not found')

        if 'displayName' in body:
            user.display_name = (body['displayName'] or '').strip()
        if 'avatar' in body:
            user.remark = (body['avatar'] or '').strip()
        if 'description' in body:
            user.phone = (body['description'] or '').strip()
        db.commit()

        return {'assistant': _user_to_assistant(user)}


@router.delete('/assistants/{assistant_id}')
def delete_assistant(assistant_id: str):
    """Soft-delete an assistant (disable the user)."""
    parsed_id = _parse_assistant_id(assistant_id)
    with SessionLocal() as db:
        user = db.query(User).filter_by(id=parsed_id).first()
        if not user or user.source != 'desktop' or user.disabled:
            raise HTTPException(status_code=404, detail='assistant not found')
        if user.username == DEFAULT_ASSISTANT['username']:
            raise HTTPException(status_code=400, detail='default assistant cannot be deleted')

        active_count = db.query(User).filter(
            User.source == 'desktop',
            User.disabled == False,
            User.tenant_id == DESKTOP_TENANT_ID,
        ).count()
        if active_count <= 1:
            raise HTTPException(status_code=400, detail='at least one assistant is required')

        user.disabled = True
        db.commit()
        return None


@router.get('/identity')
def get_identity():
    """Get Desktop mode auth info (no token required)."""
    with SessionLocal() as db:
        _ensure_desktop_bootstrap(db)
        default_user = UserRepository.get_by_username(db, DEFAULT_ASSISTANT['username'])
        default_id = str(default_user.id) if default_user else ''

        token = ''
        if default_user:
            token = create_access_token(
                subject=default_id,
                role='user',
                tenant_id=DESKTOP_TENANT_ID,
                username=DEFAULT_ASSISTANT['username'],
            )

        return {
            'token': token,
            'defaultAssistantId': default_id,
        }
