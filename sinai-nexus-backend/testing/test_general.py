# Test the general query answering functionality

from src.query_router import answer_scheduling_query

if __name__ == "__main__":
    examples = [
        "Is ct head without contrast at 1470 madison ave?",
        "Is ct head without contrast at 1176 fifth ave?",
        "Which locations do ct head without contrast?",
        "Which locations do ct chest with contrast?",
        "Which locations do ct abscess drainage?",
        # "What exams are done at 10 union square east rad ct?",  # IGNORE --- Just for testing --- extremely lengthy output
        "How long is a CT Head without contrast?",
        "Which rooms at 1470 Madison Ave perform CT Head without contrast?",
        "ct head wo rooms"
    ]
    for q in examples:
        print(f"Q: {q}")
        print("A:", answer_scheduling_query(q))
        print()