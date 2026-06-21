import pytest

from src.config import Settings
from src.core.models import RemediationTask
from src.services.remediation_engine import route_to_file_candidates
from src.workers.patch_worker import RemediationRunner, extract_repo_full_name


def test_extract_repo_full_name():
    assert (
        extract_repo_full_name("https://github.com/example/app.git")
        == "example/app"
    )


def test_route_to_file_candidates_uses_target_path():
    candidates = route_to_file_candidates("https://target.example.com/admin/users")
    assert candidates[0] == "src/app/admin/users/page.tsx"
    assert "app/admin/users/page.tsx" in candidates


@pytest.mark.asyncio
async def test_remediation_runner_opens_pr_for_target_route():
    class FakeGitHub:
        def __init__(self):
            self.file_path = None

        async def get_default_branch(self, repo_full_name):
            assert repo_full_name == "example/app"
            return "main"

        async def get_file_content(self, repo_full_name, file_path, branch):
            if file_path == "src/app/admin/page.tsx":
                return "export default function Page() { return <form /> }"
            return None

        async def create_fix_pr(
            self,
            repo_full_name,
            base_branch,
            fix_branch_name,
            file_path,
            patched_content,
            pr_title,
            pr_body,
        ):
            self.file_path = file_path
            assert patched_content == "export default function Page() { return null }"
            return "https://github.com/example/app/pull/1"

    class FakeEngine:
        async def generate_fix(self, error_log, code_snippet, file_path):
            assert file_path == "src/app/admin/page.tsx"
            assert "T1566" in error_log
            return "export default function Page() { return null }"

    runner = RemediationRunner(
        Settings(ANTHROPIC_API_KEY="anthropic-test", GITHUB_TOKEN="github-test")
    )
    fake_github = FakeGitHub()
    runner._github = fake_github
    runner._engine = FakeEngine()

    result = await runner.run(
        RemediationTask(
            audit_id="audit-1",
            repo_url="https://github.com/example/app",
            target_url="https://target.example.com/admin",
            payload="credential leak",
            aries_score=91.2,
            technique_id="T1566",
        )
    )

    assert result.status == "pr_created"
    assert result.pr_url == "https://github.com/example/app/pull/1"
    assert result.target_url == "https://target.example.com/admin"
    assert fake_github.file_path == "src/app/admin/page.tsx"
