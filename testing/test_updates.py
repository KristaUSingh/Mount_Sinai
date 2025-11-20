# Test updates to scheduling data functionality

from src.update_helpers import disable_exam, enable_exam
from src.query_router import answer_scheduling_query

if __name__ == "__main__":
    # Initial test query
    question = "Is ct head with contrast at 10 Union Square?"
    print(f"Q: {question}")
    print("A:", answer_scheduling_query(question))
    print()

    # Disable an exam at a site
    disable_exam("CT HEAD W IV CONTRAST", "10 UNION SQ E RAD CT", reason="maintenance")

    # Test query after disabling
    print(f"Q: {question}")
    print("A:", answer_scheduling_query(question))
    print()

    # Re-enable the exam
    enable_exam("CT HEAD W IV CONTRAST", "10 UNION SQ E RAD CT")

    # Test query after re-enabling
    print(f"Q: {question}")
    print("A:", answer_scheduling_query(question))
    print()

