import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Lock, Mail, UserPlus, LogIn } from 'lucide-react';

const LoginForm = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (isLogin) {
        result = await login(formData.username, formData.password);
      } else {
        result = await register(formData.username, formData.email, formData.password);
      }

      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-8">
      <div className="bg-white rounded-xl shadow-2xl p-12 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">SRC Project Swift VMS</h1>
          <h2 className="text-gray-600 font-medium">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="relative flex items-center">
              <User size={20} className="absolute left-4 text-gray-400" />
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="flex flex-col gap-2">
              <div className="relative flex items-center">
                <Mail size={20} className="absolute left-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="relative flex items-center">
              <Lock size={20} className="absolute left-4 text-gray-400" />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-base font-semibold cursor-pointer transition-transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            disabled={loading}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn size={20} />
                Sign In
              </>
            ) : (
              <>
                <UserPlus size={20} />
                Create Account
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-gray-200">
          <span className="text-gray-600">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </span>
          <button
            type="button"
            className="ml-2 text-indigo-600 font-semibold hover:underline focus:outline-none"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ username: '', email: '', password: '' });
            }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
