.PHONY: test test-fast test-all coverage coverage-html clean-coverage help

# Run tests without LLM or DB markers (fast, no external dependencies)
test-fast:
	pytest tests/ -m "not llm and not db" -v

# Run all tests except LLM tests (includes DB tests)
test:
	pytest tests/ -m "not llm" -v

# Run all tests including LLM tests (costs money!)
test-all:
	pytest tests/ -v

# Run tests with coverage report (terminal output)
coverage:
	pytest tests/ -m "not llm and not db" --cov=scripts --cov-report=term-missing

# Run tests with HTML coverage report
coverage-html:
	pytest tests/ -m "not llm and not db" --cov=scripts --cov-report=html --cov-report=term-missing
	@echo "\nCoverage report generated at htmlcov/index.html"

# Clean up coverage artifacts
clean-coverage:
	rm -rf .coverage htmlcov/

help:
	@echo "Available targets:"
	@echo "  test-fast     Run tests without LLM or DB markers (fast)"
	@echo "  test          Run all tests except LLM tests"
	@echo "  test-all      Run all tests including LLM tests (costs money!)"
	@echo "  coverage      Run tests with terminal coverage report"
	@echo "  coverage-html Run tests with HTML coverage report"
	@echo "  clean-coverage Remove coverage artifacts"
