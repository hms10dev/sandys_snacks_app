type LoadingStateProps = {
  title?: string;
  message?: string;
  emoji?: string;
};

export function LoadingState({
  title = "Loading...",
  message = "Hang tight while we get things ready.",
  emoji = "🍪",
}: LoadingStateProps) {
  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl p-8 text-center shadow-lg">
        <div className="text-4xl mb-4">{emoji}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        {message && <p className="text-gray-600 mb-6">{message}</p>}
        <div className="flex justify-center">
          <div className="h-8 w-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}

export default LoadingState;
