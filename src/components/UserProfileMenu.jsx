import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, FileText, Check, Palette, Shield, Sparkles } from 'lucide-react';

const PALETTE = [
  '#ea4335', // Google Red (Alice)
  '#34a853', // Google Green (Bob)
  '#e91e63', // Pink / Magenta (Christine)
  '#1a73e8', // Google Blue (Aditya)
  '#fbbc05', // Amber / Gold
  '#9c27b0', // Purple
  '#ff6d00', // Deep Orange
  '#00897b'  // Teal
];

export default function UserProfileMenu({
  currentUser,
  currentRole,
  onUpdateProfile,
  onOpenAuthModal,
  onOpenDashboard,
  onLogout
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || 'Collaborator');
  const [selectedColor, setSelectedColor] = useState(currentUser?.color || '#1a73e8');
  const menuRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name);
      setSelectedColor(currentUser.color);
    }
  }, [currentUser]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (onUpdateProfile) {
      onUpdateProfile({
        name: editName.trim() || 'Collaborator',
        color: selectedColor
      });
    }
    setIsEditing(false);
  };

  const initial = (currentUser?.name || 'A').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Top Bar Avatar Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-xs hover:shadow transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 cursor-pointer"
        style={{ backgroundColor: currentUser?.color || '#1a73e8' }}
        title={`Signed in as ${currentUser?.name || 'User'} (${currentRole})`}
      >
        {initial}
      </button>

      {/* Google Account Style Popover Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#282a2c] rounded-2xl shadow-2xl border border-[#dadce0] dark:border-[#444746] p-4 z-50 text-xs text-[#202124] dark:text-[#e3e3e3] animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header Profile Info */}
          <div className="flex flex-col items-center pb-3 border-b border-[#f1f3f4] dark:border-[#3c4043]">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-2 shadow-sm"
              style={{ backgroundColor: currentUser?.color || '#1a73e8' }}
            >
              {initial}
            </div>

            <div className="font-semibold text-base text-gray-900 dark:text-white text-center">
              {currentUser?.name || 'Anonymous User'}
            </div>

            <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              {currentUser?.email || 'Guest Session'}
            </div>

            <div className="mt-2 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full text-[11px] font-medium">
              <Shield className="w-3 h-3" />
              <span className="capitalize">{currentRole || 'Editor'} Access</span>
            </div>
          </div>

          {/* Quick Edit Profile Section */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="py-3 border-b border-[#f1f3f4] dark:border-[#3c4043] space-y-2.5">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 text-xs"
                  placeholder="Enter your name"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Caret & Avatar Color
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        selectedColor === c ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {selectedColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium shadow-xs"
                >
                  Save Profile
                </button>
              </div>
            </form>
          ) : (
            <div className="py-2 border-b border-[#f1f3f4] dark:border-[#3c4043] space-y-1">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full text-left px-3 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] rounded-lg flex items-center gap-2.5 font-medium transition-colors"
              >
                <Palette className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>Customize Name & Caret Color</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenDashboard) onOpenDashboard();
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] rounded-lg flex items-center gap-2.5 font-medium transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>My Documents Library</span>
              </button>
            </div>
          )}

          {/* Account Actions */}
          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenAuthModal) onOpenAuthModal();
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1.5 px-2 py-1"
            >
              <User className="w-3.5 h-3.5" />
              {currentUser?.isGuest ? 'Sign In / Register' : 'Switch Account'}
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                if (onLogout) onLogout();
              }}
              className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 font-medium flex items-center gap-1 px-2 py-1 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
