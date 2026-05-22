#!/usr/bin/env python3
with open(r'C:\Users\joses\Documents\mente-ai\src\components\ChatInterface.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find submitSuggestion streaming block
marker = "      const res = await fetch(\"/api/chat\", {\n        method: \"POST\",\n        headers: { \"Content-Type\": \"application/json\" },\n        body: JSON.stringify({ message: s,"
idx = content.find(marker)
if idx == -1:
    print("Marker not found in submitSuggestion")
    exit(1)

# Find the end of this block (processStream closure + catch)
# The block ends at "      processStream();\n    } catch {"
search_start = idx
old_end = "      processStream();\n    } catch {"
idx2 = content.find(old_end, idx)
if idx2 == -1:
    print(f"Could not find end marker, start={idx}")
    exit(1)

search_end = idx2 + len(old_end)
old_block = content[search_start:search_end]
print(f"submitSuggestion old block: {len(old_block)} chars")

new_block = '''      // Get VPS token and connect directly to VPS for streaming
      const tokenRes = await fetch('/api/auth/vps-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        if (assistantMsg) supabase.from('messages').update({ in_progress: false, content: err.error || 'Error de auth' }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: err.error || 'Error de autenticacion', created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }
      const { token: vpsToken, vpsUrl } = await tokenRes.json();

      const params = new URLSearchParams({
        token: vpsToken,
        message_id: msgId,
        user_id: userId,
        conversation_id: convId,
        mode: responseMode,
        question: s,
        attachments: JSON.stringify([]),
        user_context: JSON.stringify(userContext ? { name: userContext.full_name || '', city: userContext.city || '', interests: userContext.interests || '', notes: userContext.custom_notes || '' } : null),
      });

      const streamRes = await fetch(`${vpsUrl}/api/stream?${params.toString()}`, {
        headers: { Accept: 'text/event-stream' },
      });

      if (!streamRes.ok) {
        const errData = await streamRes.json().catch(() => ({}));
        if (assistantMsg) supabase.from('messages').update({ in_progress: false, content: errData.error || 'Error de conexion' }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: errData.error || 'Error de conexion', created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isDeep = false;

      const updateStreamText = (text: string) => {
        setDisplayedText(prev => ({ ...prev, [msgId]: text }));
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, _isDeep: isDeep } : m));
      };

      const processVPSStream = async () => {
        try {
          let result = await reader.read();
          while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\\n');
            buffer = lines[lines.length - 1] ?? '';
            for (const line of lines) {
              const eventMatch = line.match(/^event: (.+)/);
              const dataMatch = line.match(/^data: (.+)/);
              if (!eventMatch || !dataMatch) continue;
              let data: any;
              try { data = JSON.parse(dataMatch[1]); } catch { continue; }
              if (eventMatch[1] === 'chunk' && data.type === 'chunk') {
                isDeep = data.is_deep ?? false;
                const currentText = displayedText[msgId] || '';
                const newText = currentText + data.text;
                updateStreamText(newText);
                await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: newText, role: 'assistant', in_progress: true });
              } else if (eventMatch[1] === 'done' && data.type === 'done') {
                isDeep = data.is_deep ?? isDeep;
              } else if (eventMatch[1] === 'error') {
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || 'Error', _loading: false } : m));
                setSending(false);
                setStreamingMsgId(null);
                return;
              }
            }
            result = await reader.read();
          }
          const finalText = displayedText[msgId] || '';
          await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: finalText, role: 'assistant', in_progress: false });
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: finalText, _loading: false, _isDeep: isDeep } : m));
          currentStreamReqRef.current = null;
          setSending(false);
          setStreamingMsgId(null);
          const now = new Date().toISOString();
          supabase.from('conversations').update({ updated_at: now }).eq('id', convId);
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: now } : c));
          setActiveConv({ ...conv!, updated_at: now });
          if (queuedMsgRef.current) {
            const q = queuedMsgRef.current as QueuedMsg;
            queuedMsgRef.current = null;
            setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 100);
          } else {
            textareaRef.current?.focus();
          }
        } catch {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: 'Error de conexion. Intenta de nuevo.', _loading: false } : m));
          setSending(false);
          setStreamingMsgId(null);
        }
      };

      processVPSStream();
    } catch {'''

new_content = content[:search_start] + new_block + content[search_end:]
with open(r'C:\Users\joses\Documents\mente-ai\src\components\ChatInterface.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print(f'DONE. Replaced {len(old_block)} with {len(new_block)}')