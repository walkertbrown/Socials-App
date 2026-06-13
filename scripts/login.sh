#!/usr/bin/env bash
# One-time: sign in so the app can act as you (the owner of the photos).
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive
