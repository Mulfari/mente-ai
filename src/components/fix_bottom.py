with open('C:/Users/joses/Documents/mente-ai/src/components/ChatInterface.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exact text to replace - from "shrink-0 flex items-center" to end of closing div
# The pattern is: flex items-center div -> User button -> Actions div -> close div -> </div>

# Let's find the start and end of the bottom section (mobile)
# Start: "shrink-0 flex items-center" in the bottom section context
bottom_start = content.find('        {/* Bottom */}')
if bottom_start == -1:
    print("Could not find bottom section start")
    exit(1)

# Find the closing </div> that ends the mobile sidebar bottom section
# After the bottom div, there's "      </div>" (end of mobile sidebar)
# We need to find the content from "/* Bottom */" to just before "      </div>" for mobile
# The mobile bottom section ends at "        </div>\n      </div>"
# Let's find it by looking for the pattern after bottom

# Find the end: after "        </div>" (closing the bottom div), we have "      </div>" (closing the mobile sidebar body)
# Let's find the exact slice
# From the first {/* Bottom */}
section_start = content.find('        {/* Bottom */}')
print(f"Mobile bottom start at: {section_start}")

# The mobile bottom section ends with "        </div>\n      </div>"
# Let's find where that ends
# Search from section_start forward
test = content[section_start:]
# Find "        </div>" followed by "      </div>"
idx_end_pattern = test.find('        </div>')
if idx_end_pattern >= 0:
    # After the closing div, there should be "      </div>"
    rest = test[idx_end_pattern:]
    if rest.startswith('        </div>\n      </div>'):
        section_end = section_start + idx_end_pattern + len('        </div>')
        print(f"Mobile bottom end at: {section_end}")
    else:
        # Try finding it in the full content
        next_div_end = content.find('      </div>', section_start)
        section_end = next_div_end
        print(f"Mobile bottom end (alt) at: {section_end}")
else:
    print("Could not find end pattern")

# Extract the section
old_mobile = content[section_start:section_end]
print(f"Old mobile section length: {len(old_mobile)}")
print(f"First 100 chars: {repr(old_mobile[:100])}")
print(f"Last 50 chars: {repr(old_mobile[-50:])}")

# Replace with new
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
        </div>'''

if content.count(old_mobile) == 1:
    content = content.replace(old_mobile, new_mobile, 1)
    print("Mobile replaced!")
else:
    # Try direct replacement
    content = content[:section_start] + new_mobile + content[section_end:]
    print("Mobile replaced via direct slice")

# Now handle desktop bottom section (10 spaces indent)
# Find the second occurrence of {/* Bottom */}
remaining = content[section_start + len(new_mobile):]
second_bottom = remaining.find('          {/* Bottom */}')
if second_bottom >= 0:
    desktop_start = section_start + len(new_mobile) + second_bottom
    print(f"Desktop bottom start at: {desktop_start}")

    # Desktop section ends with "          </div>\n        </div>" (closing desktop sidebar body)
    remaining2 = content[desktop_start:]
    idx_d_end = remaining2.find('          </div>')
    if idx_d_end >= 0:
        rest2 = remaining2[idx_d_end:]
        if rest2.startswith('          </div>\n        </div>'):
            desktop_end = desktop_start + idx_d_end + len('          </div>')
            print(f"Desktop bottom end at: {desktop_end}")

            old_desktop = content[desktop_start:desktop_end]
            print(f"Old desktop section length: {len(old_desktop)}")
            print(f"First 100: {repr(old_desktop[:100])}")

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
          </div>'''

            content = content[:desktop_start] + new_desktop + content[desktop_end:]
            print("Desktop replaced!")
else:
    print("Could not find desktop bottom section")

with open('C:/Users/joses/Documents/mente-ai/src/components/ChatInterface.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("File written")