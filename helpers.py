""" Provides functions to use as tools in application.py """

from functools import wraps

from flask import session, redirect


def signin_required(func):
    """
    Decorate routes to require sign in.

    https://flask.palletsprojects.com/en/1.1.x/patterns/viewdecorators/
    """
    @wraps(func)
    def decorated_function(*args, **kwargs):
        if session.get("user") is None:
            return redirect("/signin")
        return func(*args, **kwargs)
    return decorated_function
