""" Provides functions to use as tools in application.py """

import os
import random

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


def dark(color):
    """ Checks if a color is dark or not """
    darkness = 1 - (0.299 * color[0] + 0.587 *
                    color[1] + 0.114 * color[2]) / 255

    if darkness > 0.5:
        return True
    return False


def random_hex_darkcolor():
    """ Return hexcode of a random dark color """

    color = []

    itr = 0
    while itr < 10000:
        for _ in range(3):
            random.seed(os.urandom(64))
            color.append(random.randrange(0, 256))

        if dark(color):
            break

        itr += 1

    return "#{:02x}{:02x}{:02x}".format(color[0], color[1], color[2])
