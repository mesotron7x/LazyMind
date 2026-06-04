"""Tests for Desktop mode assistant endpoints."""
from fastapi.testclient import TestClient


API_PREFIX = '/api/authservice/desktop'


def _data(response):
    payload = response.json()
    return payload.get('data')


def test_desktop_bootstrap_is_idempotent_and_identity_uses_default_assistant(client: TestClient):
    first = client.post(f'{API_PREFIX}/bootstrap')
    second = client.post(f'{API_PREFIX}/bootstrap')

    assert first.status_code == 200
    assert second.status_code == 200
    first_default = _data(first)['defaultAssistant']
    second_default = _data(second)['defaultAssistant']
    assert first_default['id'] == second_default['id']
    assert first_default['username'] == 'astronomer'
    assert first_default['displayName'] == '天文学家'
    assert first_default['avatar'] == '🪐'

    identity = client.get(f'{API_PREFIX}/identity')
    assert identity.status_code == 200
    identity_data = _data(identity)
    assert identity_data['token']
    assert identity_data['defaultAssistantId'] == first_default['id']

    listed = client.get(f'{API_PREFIX}/assistants')
    assert listed.status_code == 200
    assistants = _data(listed)['assistants']
    assert len(assistants) == 1
    assert assistants[0]['id'] == first_default['id']


def test_desktop_assistant_crud_and_delete_guards(client: TestClient):
    client.post(f'{API_PREFIX}/bootstrap')

    created = client.post(f'{API_PREFIX}/assistants', json={
        'username': 'writer',
        'displayName': '写作助手',
        'avatar': '✍️',
        'description': 'drafts text',
    })
    assert created.status_code == 200
    created_assistant = _data(created)['assistant']
    assert created_assistant['username'] == 'writer'
    assert created_assistant['displayName'] == '写作助手'

    duplicate = client.post(f'{API_PREFIX}/assistants', json={
        'username': 'writer',
        'displayName': 'Duplicate',
    })
    assert duplicate.status_code == 409

    invalid = client.get(f'{API_PREFIX}/assistants/not-a-uuid')
    assert invalid.status_code == 400

    updated = client.patch(f"{API_PREFIX}/assistants/{created_assistant['id']}", json={
        'displayName': '编辑助手',
        'avatar': '📝',
        'description': 'edits text',
    })
    assert updated.status_code == 200
    updated_assistant = _data(updated)['assistant']
    assert updated_assistant['displayName'] == '编辑助手'
    assert updated_assistant['avatar'] == '📝'
    assert updated_assistant['description'] == 'edits text'

    listed = client.get(f'{API_PREFIX}/assistants')
    assistants = _data(listed)['assistants']
    default_assistant = next(item for item in assistants if item['username'] == 'astronomer')

    delete_default = client.delete(f"{API_PREFIX}/assistants/{default_assistant['id']}")
    assert delete_default.status_code == 400

    deleted = client.delete(f"{API_PREFIX}/assistants/{created_assistant['id']}")
    assert deleted.status_code == 200

    missing = client.get(f"{API_PREFIX}/assistants/{created_assistant['id']}")
    assert missing.status_code == 404

    final_list = client.get(f'{API_PREFIX}/assistants')
    assert [item['username'] for item in _data(final_list)['assistants']] == ['astronomer']


def test_desktop_create_requires_username(client: TestClient):
    response = client.post(f'{API_PREFIX}/assistants', json={
        'displayName': 'No Username',
    })

    assert response.status_code == 400
