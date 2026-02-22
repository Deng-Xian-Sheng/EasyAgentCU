from easyagentcu.computer.adapter import MockComputer
from easyagentcu.computer.robust_click import robust_click


def test_robust_click_success():
    computer = MockComputer()
    result = robust_click(computer, 320, 225, max_iter=5)
    assert result.attempts >= 1
    assert result.annotated_data_url.startswith('data:image/png;base64,')
