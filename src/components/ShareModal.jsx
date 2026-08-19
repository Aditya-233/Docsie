import { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Globe,
  HelpCircle,
  Settings,
  Link,
  Check,
  ChevronDown
} from 'lucide-react';

/**
 * ShareModal Component (Pixel-perfect match to Google Docs specifications & Reference Images 0, 1, 2).
 * 
 * Features:
 * - Header: 'Share "Document Title"' with Help '?' and Settings '⚙️' icons
 * - Search input: "Add people, groups, spaces, and calendar events" with blue focus outline
 * - People with access list: Owner ("Aditya Padhi (you)") + granular collaborator management
 * - General access section:
 *   - Lock / Globe icon toggle
 *   - "Restricted" vs "Anyone with the link" dropdown
 *   - "Viewer" / "Commenter" / "Editor" role dropdown with active checkmark
 * - "Copy link" pill button with Link icon & copy confirmation toast
 * - "Done" blue pill button
 */
export default function ShareModal({
  isOpen = false,
  onClose,
  docTitle = 'Project Overview & Strategy 2026',
  owner = { name: 'Aditya Padhi', email: 'aditya.padhi@gmail.com' },
  collaborators = [],
  generalAccess = 'restricted', // 'restricted' | 'anyone'
  generalRole = 'viewer', // 'viewer' | 'commenter' | 'editor'
  onUpdateGeneralAccess,
  onUpdateGeneralRole,
  onAddCollaborator,
  onUpdateCollaboratorRole,
  onRemoveCollaborator,
  shareUrl = ''
}) {
  const [searchInput, setSearchInput] = useState('');
  const [selectedAddRole, setSelectedAddRole] = useState('editor');
  const [isAccessDropdownOpen, setIsAccessDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [activeCollabDropdown, setActiveCollabDropdown] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const modalRef = useRef(null);

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle outside clicks for dropdowns
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest('.dropdown-container')) {
        setIsAccessDropdownOpen(false);
        setIsRoleDropdownOpen(false);
        setActiveCollabDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const urlToCopy = shareUrl || window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(urlToCopy);
    }
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;

    if (onAddCollaborator) {
      onAddCollaborator({
        name: trimmed.includes('@') ? trimmed.split('@')[0] : trimmed,
        email: trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        role: selectedAddRole
      });
    }
    setSearchInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] transition-opacity select-none">
      {/* Modal Container (Material 3 rounded-3xl / 28px) */}
      <div
        ref={modalRef}
        className="w-full max-w-[560px] bg-white dark:bg-[#282a2c] rounded-[28px] shadow-2xl p-6 border border-[#e0e2e0] dark:border-[#444746] animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-5 text-[#1f1f1f] dark:text-[#e3e3e3]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header: Title + Help & Settings Icons */}
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-normal tracking-tight text-[#1f1f1f] dark:text-[#e3e3e3] truncate pr-4">
            Share "{docTitle}"
          </h2>
          <div className="flex items-center gap-1">
            <button
              className="p-2 rounded-full text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f1f3f4] dark:hover:bg-[#333538] transition-colors"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              className="p-2 rounded-full text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f1f3f4] dark:hover:bg-[#333538] transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search / Add Collaborator Input Box (Image 2) */}
        <form onSubmit={handleAddSubmit} className="relative">
          <div className="flex items-center border border-[#747775] dark:border-[#8e918f] rounded-lg px-3.5 py-2.5 bg-white dark:bg-[#1e1f20] focus-within:border-[#1a73e8] focus-within:ring-2 focus-within:ring-[#1a73e8]/20 transition-all">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Add people, groups, spaces, and calendar events"
              className="w-full bg-transparent text-sm text-[#1f1f1f] dark:text-[#e3e3e3] placeholder-[#747775] dark:placeholder-[#8e918f] outline-none"
            />
            {searchInput && (
              <div className="flex items-center gap-2 pl-2">
                <select
                  value={selectedAddRole}
                  onChange={(e) => setSelectedAddRole(e.target.value)}
                  className="text-xs bg-transparent text-[#444746] dark:text-[#c4c7c5] font-medium outline-none cursor-pointer"
                >
                  <option value="editor">Editor</option>
                  <option value="commenter">Commenter</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium px-3 py-1 rounded-md"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </form>

        {/* People With Access Section */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#444746] dark:text-[#c4c7c5]">
            People with access
          </h3>

          <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
            {/* Owner Row */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#00796b] text-white flex items-center justify-center font-medium text-sm">
                  {owner.name ? owner.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">
                    {owner.name} (you)
                  </span>
                  <span className="text-xs text-[#727775] dark:text-[#8e918f]">
                    {owner.email || 'aditya.padhi@gmail.com'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-medium text-[#727775] dark:text-[#8e918f] pr-2">
                Owner
              </span>
            </div>

            {/* Other Collaborators */}
            {collaborators.map((collab) => (
              <div key={collab.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full text-white flex items-center justify-center font-medium text-sm"
                    style={{ backgroundColor: collab.color || '#e91e63' }}
                  >
                    {collab.avatar ? (
                      <img
                        src={collab.avatar}
                        alt={collab.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      (collab.name || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">
                      {collab.name}
                    </span>
                    <span className="text-xs text-[#727775] dark:text-[#8e918f]">
                      {collab.email || `${collab.role || 'editor'}@docs.com`}
                    </span>
                  </div>
                </div>

                {/* Role dropdown for Collaborator */}
                <div className="relative dropdown-container">
                  <button
                    onClick={() =>
                      setActiveCollabDropdown(
                        activeCollabDropdown === collab.id ? null : collab.id
                      )
                    }
                    className="flex items-center gap-1.5 text-xs font-medium text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f1f3f4] dark:hover:bg-[#333538] px-2.5 py-1.5 rounded transition-colors"
                  >
                    <span className="capitalize">{collab.role || 'Editor'}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {activeCollabDropdown === collab.id && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs">
                      {['viewer', 'commenter', 'editor'].map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            if (onUpdateCollaboratorRole) {
                              onUpdateCollaboratorRole(collab.id, role);
                            }
                            setActiveCollabDropdown(null);
                          }}
                          className="w-full text-left px-3.5 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between capitalize"
                        >
                          <span>{role}</span>
                          {collab.role === role && (
                            <Check className="w-3.5 h-3.5 text-[#1a73e8]" />
                          )}
                        </button>
                      ))}
                      <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                      <button
                        onClick={() => {
                          if (onRemoveCollaborator) {
                            onRemoveCollaborator(collab.id);
                          }
                          setActiveCollabDropdown(null);
                        }}
                        className="w-full text-left px-3.5 py-1.5 hover:bg-[#fce8e6] text-[#b3261e] dark:hover:bg-[#601410]"
                      >
                        Remove access
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* General Access Section (Reference Images 0, 1, 2) */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#e0e2e0] dark:border-[#444746]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#444746] dark:text-[#c4c7c5]">
            General access
          </h3>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3.5">
              {/* Globe / Lock Icon */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  generalAccess === 'anyone'
                    ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                    : 'bg-[#f1f3f4] text-[#5f6368] dark:bg-[#333538] dark:text-[#c4c7c5]'
                }`}
              >
                {generalAccess === 'anyone' ? (
                  <Globe className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>

              {/* Access Dropdown & Subtext */}
              <div className="flex flex-col">
                <div className="relative dropdown-container">
                  <button
                    onClick={() => setIsAccessDropdownOpen(!isAccessDropdownOpen)}
                    className="flex items-center gap-1.5 text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#333538] px-1.5 py-0.5 rounded transition-colors -ml-1.5"
                  >
                    <span>
                      {generalAccess === 'anyone' ? 'Anyone with the link' : 'Restricted'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[#5f6368] dark:text-[#8e918f]" />
                  </button>

                  {/* Access Level Dropdown Menu (Image 1) */}
                  {isAccessDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 w-60 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs">
                      <button
                        onClick={() => {
                          if (onUpdateGeneralAccess) onUpdateGeneralAccess('restricted');
                          setIsAccessDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">Restricted</span>
                          <span className="text-[11px] text-[#727775]">
                            Only people with access can open
                          </span>
                        </div>
                        {generalAccess === 'restricted' && (
                          <Check className="w-4 h-4 text-[#1a73e8]" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (onUpdateGeneralAccess) onUpdateGeneralAccess('anyone');
                          setIsAccessDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">Anyone with the link</span>
                          <span className="text-[11px] text-[#727775]">
                            Anyone on the Internet with the link can access
                          </span>
                        </div>
                        {generalAccess === 'anyone' && (
                          <Check className="w-4 h-4 text-[#1a73e8]" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-xs text-[#727775] dark:text-[#8e918f]">
                  {generalAccess === 'anyone'
                    ? `Anyone on the Internet with the link can ${generalRole}`
                    : 'Only people with access can open with the link'}
                </span>
              </div>
            </div>

            {/* General Role Dropdown (Image 0) */}
            {generalAccess === 'anyone' && (
              <div className="relative dropdown-container">
                <button
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f1f3f4] dark:hover:bg-[#333538] px-2.5 py-1.5 rounded transition-colors capitalize"
                >
                  <span>{generalRole}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Role Dropdown Menu with Checkmark on active role (Image 0) */}
                {isRoleDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs">
                    {['viewer', 'commenter', 'editor'].map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          if (onUpdateGeneralRole) onUpdateGeneralRole(role);
                          setIsRoleDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between capitalize font-medium"
                      >
                        <span>{role}</span>
                        {generalRole === role && (
                          <Check className="w-3.5 h-3.5 text-[#1a73e8]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions: Copy Link Pill + Done Button (Images 0, 1, 2) */}
        <div className="flex items-center justify-between pt-2 border-t border-[#e0e2e0] dark:border-[#444746] mt-1">
          {/* Copy Link Button */}
          <div className="relative">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 border border-[#747775] dark:border-[#8e918f] hover:bg-[#f1f3f4] dark:hover:bg-[#333538] text-[#1a73e8] dark:text-[#8ab4f8] px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              <Link className="w-4 h-4" />
              <span>Copy link</span>
            </button>

            {/* Copy Feedback Toast */}
            {copyFeedback && (
              <div className="absolute left-0 bottom-full mb-2 bg-[#282a2c] text-white text-xs py-1 px-3 rounded shadow-md whitespace-nowrap tooltip-animate">
                Link copied to clipboard
              </div>
            )}
          </div>

          {/* Done Pill Button */}
          <button
            onClick={onClose}
            className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-6 py-2 rounded-full text-sm font-medium shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
