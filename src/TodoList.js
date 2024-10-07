import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Trash2, RefreshCcw, AlertCircle } from 'lucide-react';
import { useEthereum } from './EthereumContext';
import { ethers } from 'ethers';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ABI = [
  "function addTodo(string memory _text) public",
  "function toggleTodo(uint256 _index) public",
  "function removeTodo(uint256 _index) public",
  "function getTodos() public view returns (tuple(string text, bool completed)[] memory)",
  "function getTodoCount() public view returns (uint256)"
];

const CONTRACT_ADDRESS = "0x06EF666E96A25E703Ff19A9ABe4EDae8Efa4a471";

const TodoItem = React.memo(({ todo, index, onToggle, onRemove, disabled }) => (
  <li className="flex items-center bg-gray-50 p-3 rounded-lg shadow-sm transition duration-300 ease-in-out hover:shadow-md">
    <input
      type="checkbox"
      checked={todo.completed}
      onChange={() => onToggle(index)}
      className="form-checkbox h-5 w-5 text-blue-600 transition duration-150 ease-in-out"
      disabled={disabled}
    />
    <span className={`flex-grow ml-3 ${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
      {todo.text}
    </span>
    <button
      onClick={() => onRemove(index)}
      className="text-red-500 hover:text-red-700 focus:outline-none transition duration-300 ease-in-out disabled:opacity-50"
      disabled={disabled}
    >
      <Trash2 size={20} />
    </button>
  </li>
));

const TodoInput = React.memo(({ value, onChange, onSubmit, disabled }) => (
  <div className="flex mb-6">
    <input
      type="text"
      className="flex-grow p-3 border-2 border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      placeholder="Add a new todo"
      value={value}
      onChange={onChange}
      onKeyPress={(e) => e.key === 'Enter' && onSubmit()}
      disabled={disabled}
    />
    <button
      className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-r-lg transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
      onClick={onSubmit}
      disabled={disabled || value.trim() === ''}
    >
      <PlusCircle size={24} />
    </button>
  </div>
));

const ErrorMessage = React.memo(({ message }) => (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{message}</AlertDescription>
  </Alert>
));

const LoadingSpinner = React.memo(() => (
  <div className="flex justify-center items-center">
    <RefreshCcw className="animate-spin text-blue-500" size={24} />
  </div>
));

const TodoList = () => {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contract, setContract] = useState(null);
  const [todoCount, setTodoCount] = useState(0);
  const [transactionPending, setTransactionPending] = useState(false);
  
  const { account, signer, isLoading, error: ethereumError } = useEthereum();

  const handleError = useCallback((error, customMessage) => {
    console.error(customMessage, error);
    setError(`${customMessage}: ${error.message}`);
    setLoading(false);
  }, []);

  const checkTodoCount = useCallback(async () => {
    if (!contract) return;
    try {
      const count = await contract.getTodoCount();
      setTodoCount(count.toNumber());
    } catch (err) {
      console.error("Error in getTodoCount:", err);
    }
  }, [contract]);

  const fetchTodos = useCallback(async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const fetchedTodos = await contract.getTodos();
      setTodos(Array.isArray(fetchedTodos) ? fetchedTodos : []);
      setError(null);
      await checkTodoCount();
    } catch (err) {
      handleError(err, "Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  }, [contract, handleError, checkTodoCount]);

  const initContract = useCallback(async () => {
    if (!signer) return;
    try {
      const todoContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(todoContract);
    } catch (err) {
      handleError(err, "Failed to initialize contract");
    }
  }, [signer, handleError]);

  useEffect(() => {
    if (!isLoading && !ethereumError) {
      initContract();
    }
  }, [initContract, isLoading, ethereumError]);

  useEffect(() => {
    if (contract) {
      fetchTodos();
    }
  }, [contract, fetchTodos]);

  const addTodo = useCallback(async () => {
    if (newTodo.trim() === '' || !contract) return;
    try {
      setTransactionPending(true);
      const tx = await contract.addTodo(newTodo);
      await tx.wait();
      setNewTodo('');
      await fetchTodos();
      setError(null);
    } catch (err) {
      handleError(err, "Failed to add todo");
    } finally {
      setTransactionPending(false);
    }
  }, [newTodo, contract, fetchTodos, handleError]);

  const toggleTodo = useCallback(async (index) => {
    if (!contract) return;
    try {
      setTransactionPending(true);
      const tx = await contract.toggleTodo(index);
      await tx.wait();
      await fetchTodos();
      setError(null);
    } catch (err) {
      handleError(err, "Failed to toggle todo");
    } finally {
      setTransactionPending(false);
    }
  }, [contract, fetchTodos, handleError]);

  const removeTodo = useCallback(async (index) => {
    if (!contract) return;
    try {
      setTransactionPending(true);
      const tx = await contract.removeTodo(index);
      await tx.wait();
      await fetchTodos();
      setError(null);
    } catch (err) {
      handleError(err, "Failed to remove todo");
    } finally {
      setTransactionPending(false);
    }
  }, [contract, fetchTodos, handleError]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (ethereumError) {
    return <ErrorMessage message={ethereumError} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100 py-10 px-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Ethereum Todo List</h1>
          {account ? (
            <>
              <p className="mb-4 text-sm text-gray-600">Connected: {account}</p>
              <p className="mb-4 text-sm text-gray-600">Contract Address: {CONTRACT_ADDRESS}</p>
              <p className="mb-4 text-sm text-gray-600">Todo Count: {todoCount}</p>
              <TodoInput
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onSubmit={addTodo}
                disabled={loading || transactionPending}
              />
              {error && <ErrorMessage message={error} />}
              {(loading || transactionPending) && <LoadingSpinner />}
              <ul className="space-y-3">
                {todos.map((todo, index) => (
                  <TodoItem
                    key={index}
                    todo={todo}
                    index={index}
                    onToggle={toggleTodo}
                    onRemove={removeTodo}
                    disabled={loading || transactionPending}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-red-500">Please connect your Ethereum wallet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TodoList;