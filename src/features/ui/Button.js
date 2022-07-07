export default function Button({ children, ...props }) {
  return <button className="px-4 py-2 hover:bg-blue-800 bg-blue-900 mr-2 rounded-lg" {...props}>
    {children}
  </button>;
}
