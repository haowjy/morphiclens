def list_files() -> dict[str, list[str]]:
    """
    List all files in the current directory.
    """
    return {
        "files": [f for f in os.listdir() if os.path.isfile(f)],
        "directories": [f for f in os.listdir() if os.path.isdir(f)],
    }
    