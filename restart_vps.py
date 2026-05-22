import paramiko, time

host = '177.7.46.156'
user = 'root'
password = "L3l'cyvqq4M;uGhd@Jf@"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, allow_agent=False, look_for_keys=False)

# Kill port 3000
stdin, stdout, stderr = client.exec_command('fuser -k 3000/tcp 2>&1; sleep 1')
print('KILL:', stdout.read().decode(), stderr.read().decode())

# Start new
stdin, stdout, stderr = client.exec_command('cd /root/vechat-orchestrator && node dist/index.js > /root/orchestrator.log 2>&1 &')
print('START:', stdout.read().decode(), stderr.read().decode())

# Wait for startup
time.sleep(3)

# Check health
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/health')
print('HEALTH:', stdout.read().decode())

# Test summarize
payload = '{"conversation_history": "Usuario: hola tengo un Corolla 2015\\nAsistente: Hola! En que te puedo ayudar?\\nUsuario: donde consigo amortiguadores"}'
stdin, stdout, stderr = client.exec_command(f'curl -s -X POST http://localhost:3000/api/summarize -H "Content-Type: application/json" -d "{payload}"')
out = stdout.read().decode()
print('SUMMARIZE RESPONSE:', out[:500])

client.close()