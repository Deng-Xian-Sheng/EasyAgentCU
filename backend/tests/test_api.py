from fastapi.testclient import TestClient
from easyagentcu.main import app


def test_health():
    client = TestClient(app)
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['ok'] is True


def test_send_message_returns_task_id():
    client = TestClient(app)
    r = client.post('/api/chat/send', json={'session_id': 's1', 'text': 'hello'})
    assert r.status_code == 200
    assert 'task_id' in r.json()
