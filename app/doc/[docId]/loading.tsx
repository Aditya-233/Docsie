export default function DocumentLoading() {
  return (
    <div className="h-screen flex flex-col bg-[#f9fbfd] overflow-hidden select-none">
      {/* Top Header Skeleton */}
      <header className="bg-white border-b border-[#dadce0] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Logo */}
          <div className="w-9 h-10 bg-blue-200 rounded animate-pulse" />
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <div className="w-40 h-5 bg-gray-200 rounded animate-pulse" />
              <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-20 h-4 bg-gray-200 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-12 h-3.5 bg-gray-100 rounded" />
              <div className="w-12 h-3.5 bg-gray-100 rounded" />
              <div className="w-12 h-3.5 bg-gray-100 rounded" />
              <div className="w-12 h-3.5 bg-gray-100 rounded" />
              <div className="w-12 h-3.5 bg-gray-100 rounded" />
            </div>
          </div>
        </div>

        {/* Right presence & share skeleton */}
        <div className="flex items-center space-x-3">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white animate-pulse" />
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="w-24 h-9 bg-blue-200 rounded-full animate-pulse" />
        </div>
      </header>

      {/* Shimmering Toolbar */}
      <div className="bg-[#edf2fa] border-b border-[#dadce0] px-4 py-1.5 flex items-center space-x-2 overflow-x-hidden">
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="h-4 w-[1px] bg-gray-300 mx-1" />
        <div className="w-24 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-28 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-12 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="h-4 w-[1px] bg-gray-300 mx-1" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="h-4 w-[1px] bg-gray-300 mx-1" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
        <div className="w-6 h-6 bg-gray-300/60 rounded animate-pulse" />
      </div>

      {/* Ruler Skeleton */}
      <div className="h-4 bg-[#f1f3f4] border-b border-[#dadce0] w-full max-w-[816px] mx-auto opacity-50" />

      {/* Page Canvas Skeleton */}
      <div className="flex-1 overflow-y-auto docs-page-container flex justify-center py-6">
        <div className="w-[816px] min-h-[1056px] bg-white shadow-md rounded-xs p-[72px] space-y-6 animate-pulse">
          <div className="w-3/5 h-8 bg-gray-200 rounded" />
          <div className="w-2/5 h-5 bg-gray-100 rounded" />
          <div className="space-y-2.5 pt-4">
            <div className="w-full h-3.5 bg-gray-200 rounded" />
            <div className="w-full h-3.5 bg-gray-200 rounded" />
            <div className="w-4/5 h-3.5 bg-gray-200 rounded" />
            <div className="w-full h-3.5 bg-gray-100 rounded" />
          </div>
          <div className="w-1/3 h-6 bg-gray-200 rounded pt-4" />
          <div className="space-y-2.5">
            <div className="w-full h-3.5 bg-gray-200 rounded" />
            <div className="w-5/6 h-3.5 bg-gray-200 rounded" />
            <div className="w-3/4 h-3.5 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
