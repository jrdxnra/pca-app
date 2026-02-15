
import os
import subprocess
import sys

def main():
    env_file = '.env.production'
    if not os.path.exists(env_file):
        print(f"Error: {env_file} not found")
        sys.exit(1)

    substitutions = []
    required_keys = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI'
    ]

    env_vars = {}
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                env_vars[key] = value

    for key in required_keys:
        if key not in env_vars:
            print(f"Error: Missing required env var {key}")
            sys.exit(1)
        # Cloud Build substitutions usually start with underscore to avoid conflicts
        substitutions.append(f"_{key}={env_vars[key]}")

    # Get SHORT_SHA
    try:
        short_sha = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD']).decode('utf-8').strip()
    except:
        import time
        short_sha = f"manual-{int(time.time())}"
    
    substitutions.append(f"SHORT_SHA={short_sha}")

    subs_string = ",".join(substitutions)
    
    gcloud_cmd = './google-cloud-sdk/bin/gcloud'
    if not os.path.exists(gcloud_cmd):
        gcloud_cmd = 'gcloud'

    cmd = [
        gcloud_cmd, 'builds', 'submit',
        '--config', 'cloudbuild.yaml',
        '.',
        '--project', 'performancecoachapp-26bd1',
        f'--substitutions={subs_string}'
    ]

    print(f"Running: {' '.join(cmd)}")
    
    # Set CLOUDSDK_PYTHON to system python3 to avoid bundled python issues
    env = os.environ.copy()
    env['CLOUDSDK_PYTHON'] = '/usr/bin/python3'
    
    subprocess.check_call(cmd, env=env)

if __name__ == '__main__':
    main()
