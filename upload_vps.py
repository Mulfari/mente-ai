import paramiko

host = '177.7.46.156'
user = 'root'
password = "L3l'cyvqq4M;uGhd@Jf@"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, allow_agent=False, look_for_keys=False)

# Upload orchestrator.ts
with open(r'C:\Users\joses\Documents\mente-ai\orchestrator_new.ts', 'r', encoding='utf-8') as f:
    content = f.read()
sftp = client.open_sftp()
with sftp.open('/root/vechat-orchestrator/src/orchestrator.ts', 'w') as remote:
    remote.write(content)
print(f"Uploaded orchestrator.ts ({len(content)} chars)")

# Upload index.ts
with open(r'C:\Users\joses\Documents\mente-ai\index_new.ts', 'r', encoding='utf-8') as f:
    content = f.read()
with sftp.open('/root/vechat-orchestrator/src/index.ts', 'w') as remote:
    remote.write(content)
print(f"Uploaded index.ts ({len(content)} chars)")

sftp.close()

# Build and restart
stdin, stdout, stderr = client.exec_command('cd /root/vechat-orchestrator && npm run build 2>&1')
out = stdout.read().decode()
err = stderr.read().decode()
print("BUILD OUTPUT:", out[-1000:])
print("BUILD ERR:", err[-500:])

# Check if build succeeded
if 'error' in err.lower() and 'error' not in out.lower():
    print("ERRORS:", err)
else:
    # Restart service
    stdin, stdout, stderr = client.exec_command('systemctl restart vechat-orchestrator 2>&1; sleep 2; systemctl status vechat-orchestrator --no-pager 2>&1 | head -10')
    print("RESTART:", stdout.read().decode())
    print("RESTART ERR:", stderr.read().decode())

client.close()