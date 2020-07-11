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


def light(red, green, blue):
    """ Checks if a color is light or not """
    darkness = 1 - (0.299 * red + 0.587 *
                    green + 0.114 * blue) / 255

    if darkness < 0.5:
        return True
    return False


def random_hex_lightcolor():
    """ Return hexcode of a random light color """
    itr = 0
    rgb = [0, 0, 0]

    while itr < 100000:
        for idx in range(3):
            random.seed(os.urandom(64))
            rgb[idx] = random.randint(0, 255)

        red, green, blue = rgb

        if light(red, green, blue):
            break

        itr += 1

    return "#{:02x}{:02x}{:02x}".format(red, green, blue)
