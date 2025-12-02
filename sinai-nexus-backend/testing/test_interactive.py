from src.query_router import answer_scheduling_query

if __name__ == "__main__":
    q = ""
    while q  != "exit":
        q = input("Enter your scheduling query (or type 'exit' to quit): ")
        if q.lower() != "exit":
            print("A:", answer_scheduling_query(q))
            print()
