from app.models import PromptRecord
from app.repositories.prompt_repository import PromptRepository


class PromptService:
    def __init__(self, prompt_repository: PromptRepository) -> None:
        self.prompt_repository = prompt_repository

    def list_prompts(self) -> list[PromptRecord]:
        return self.prompt_repository.list_prompts()

    def get_prompt(self, prompt_name: str) -> PromptRecord:
        return self.prompt_repository.get_prompt(prompt_name)

    def update_prompt(self, prompt_name: str, content: str) -> PromptRecord:
        return self.prompt_repository.update_prompt(prompt_name, content)

    def delete_prompt(self, prompt_name: str) -> None:
        self.prompt_repository.delete_prompt(prompt_name)
