import paramiko

host = '177.7.46.156'
user = 'root'
password = "L3l'cyvqq4M;uGhd@Jf@"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, allow_agent=False, look_for_keys=False)

stdin, stdout, stderr = client.exec_command('cat /root/vechat-orchestrator/src/orchestrator.ts')
content = stdout.read().decode()
open(r'C:\Users\joses\Documents\mente-ai\orchestrator_original.ts', 'w', encoding='utf-8').write(content)
print(f"Downloaded {len(content)} chars")

stdin, stdout, stderr = client.exec_command('cat /root/vechat-orchestrator/src/index.ts')
content = stdout.read().decode()
open(r'C:\Users\joses\Documents\mente-ai\index_original.ts', 'w', encoding='utf-8').write(content)
print(f"Downloaded index.ts {len(content)} chars")

client.close()