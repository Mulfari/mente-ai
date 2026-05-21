with open('C:/Users/joses/Documents/mente-ai/src/components/ChatInterface.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Mobile bottom section (8 spaces indent)
new_mobile = '''        {/* Bottom */}
        <div className="px-3 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => setShowAccountMenu(true)}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ backgroundColor: "transparent" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 0 12px rgba(16,163,127,0.35)" }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-[private model]in-w-0 text-left">
              <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{userEmail}</p>
              {profile && (
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {(profile.subscription_weeks ?? 0) !== 0 ? `${profile.subscription_weeks} semanas` : "Sin suscripcion"}
                </p>
              )}
            </div>
            {profile && (
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "var(--primary)" : "var(--danger)", boxShadow: (profile.subscription_weeks ?? 0) !== 0 ? "0 0 6px rgba(16,163,127,0.6)" : "none" }} />
            )}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all mt-1"
            style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "transparent" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-xs">Cerrar sesion</span>
          </button>
        </div>
      </div>'''

old_mobile = '''        {/* Bottom */}
        <div className="px-3 pb-4 pt-2 shrink-0 flex items-center" style={{ borderTop: "1px solid var(--border)" }}>
          {/* User */}
          <button onClick={() => setShowAccountMenu(true)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all flex-[private model]in-w-0"
            style={{ color: "rgba(255,255,255,0.8)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{userEmail}</span>
            {profile && (
              <div className="w-1.5 h-1.5 rounded-full ml-1 shrink-0"
                style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "var(--primary)" : "var(--danger)" }} />
            )}
          </button>
          {/* Actions */}
          <div className="flex items-center gap-[private model]l-2">
                        <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: "rgba(255,255,255,0.8)", backgroundColor: "var(--surface-hover)", display: "none" }}
              title="Cerrar sesión">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>'''

count = content.count(old_mobile)
print(f"Mobile old found: {count} times")
if count == 1:
    content = content.replace(old_mobile, new_mobile, 1)
    print("Mobile replaced successfully")
else:
    print("NOT replacing - count != 1")

# Desktop bottom section (10 spaces indent)
new_desktop = '''          {/* Bottom */}
          <div className="px-3 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setShowAccountMenu(true)}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{ backgroundColor: "transparent" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 0 12px rgba(16,163,127,0.35)" }}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex-[private model]in-w-0 text-left">
                <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{userEmail}</p>
                {profile && (
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {(profile.subscription_weeks ?? 0) !== 0 ? `${profile.subscription_weeks} semanas` : "Sin suscripcion"}
                  </p>
                )}
              </div>
              {profile && (
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "var(--primary)" : "var(--danger)", boxShadow: (profile.subscription_weeks ?? 0) !== 0 ? "0 0 6px rgba(16,163,127,0.6)" : "none" }} />
              )}
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all mt-1"
              style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "transparent" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs">Cerrar sesion</span>
            </button>
          </div>
        </div>'''

old_desktop = '''          {/* Bottom */}
          <div className="px-3 pb-4 pt-2 shrink-0 flex items-center" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setShowAccountMenu(true)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all flex-[private model]in-w-0"
              style={{ color: "rgba(255,255,255,0.8)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{userEmail}</span>
            </button>
              <div className="flex items-center gap-[private model]l-2">
                                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: "rgba(255,255,255,0.8)", backgroundColor: "var(--surface-hover)" }}
                  title="Cerrar sesión">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>'''

count_d = content.count(old_desktop)
print(f"Desktop old found: {count_d} times")
if count_d == 1:
    content = content.replace(old_desktop, new_desktop, 1)
    print("Desktop replaced successfully")
else:
    print("NOT replacing desktop - count != 1")

with open('C:/Users/joses/Documents/mente-ai/src/components/ChatInterface.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File written")