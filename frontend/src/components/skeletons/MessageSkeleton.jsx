const MessageSkeleton = () => {
  // Create 6 skeleton elements to display message loadings
  const skeletonMessages = Array(6).fill(null);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {skeletonMessages.map((_, idx) => {
        const isLeft = idx % 2 === 0;
        return (
          <div key={idx} className={`chat ${isLeft ? "chat-start" : "chat-end"}`}>
            <div className="chat-image avatar">
              <div className="size-10 rounded-full">
                <div className="skeleton w-full h-full rounded-full" />
              </div>
            </div>

            <div className="chat-header mb-1">
              <div className="skeleton h-3 w-16" />
            </div>

            <div className="chat-bubble bg-transparent p-0">
              <div className="skeleton h-16 w-[200px] sm:w-[250px]" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageSkeleton;
