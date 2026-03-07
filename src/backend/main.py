from app import create_app

app = create_app()


def main() -> None:
    app.run()


if __name__ == "__main__":
    main()
