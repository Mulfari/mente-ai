import paramiko, sys

host = '177.7.46.156'
user = 'root'
password = "L3l'cyvqq4M;uGhd@Jf@"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, allow_agent=False, look_for_keys=False)

# Read current files
stdin, stdout, stderr = client.exec_command('cat /root/vechat-orchestrator/src/orchestrator.ts')
orchestrator = stdout.read().decode()
client.close()

# Check current process method to see exact text
print("=== CURRENT orchestrator.ts ===")
print(orchestrator[:2000])
print("\n=== Looking for key strings ===")
for line in orchestrator.split('\n'):
    if 'return {' in line and 'response' in line:
        print("RETURN LINE:", line[:200])