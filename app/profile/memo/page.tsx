'use client';

import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Star, FileText, CheckSquare, Trash2, Plus, Loader2, ChevronDown, ChevronLeft, ChevronRight, Type, Palette, ArrowRight, Check, Camera, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  bold?: boolean;
  color?: string;
}

interface DailyData {
  todolist: TodoItem[];
}

interface TodoContextMenu {
  show: boolean;
  x: number;
  y: number;
  item: TodoItem | null;
}

interface TextContextMenu {
  show: boolean;
  x: number;
  y: number;
  selection: {
    start: number;
    end: number;
    text: string;
  } | null;
}

export default function MemoPage() {
  const { currentUser } = useSelector((state: any) => state.user);
  
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">로그인이 필요한 서비스입니다</h2>
          <p className="text-gray-600">메모 기능을 사용하려면 회원가입 후 로그인해주세요.</p>
          <div className="space-x-4">
            <Button onClick={() => window.location.href = '/login'} className="bg-blue-600 hover:bg-blue-700 text-white">
              로그인
            </Button>
            <Button onClick={() => window.location.href = '/signup'} className="bg-green-600 hover:bg-green-700 text-white">
              회원가입
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'important' | 'comfortable' | 'todolist'>('important');
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggedTodo, setDraggedTodo] = useState<TodoItem | null>(null);
  
  const [dailyData, setDailyData] = useState<DailyData>({
    todolist: [],
  });

  const [importantText, setImportantText] = useState('');
  const [comfortableText, setComfortableText] = useState('');
  const [newTodo, setNewTodo] = useState('');

  const [todoContextMenu, setTodoContextMenu] = useState<TodoContextMenu>({
    show: false,
    x: 0,
    y: 0,
    item: null,
  });

  const [textContextMenu, setTextContextMenu] = useState<TextContextMenu>({
    show: false,
    x: 0,
    y: 0,
    selection: null,
  });

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<{
    type: 'todo' | 'text' | null;
    item?: TodoItem | null;
    textSelection?: {
      start: number;
      end: number;
      text: string;
      tab: 'important' | 'comfortable';
    } | null;
  }>({
    type: null,
    item: null,
    textSelection: null,
  });

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showScheduleSuggestion, setShowScheduleSuggestion] = useState(false);
  const [suggestedSchedules, setSuggestedSchedules] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formattedDate = formatDate(selectedDate);

  useEffect(() => {
    const handleClick = () => {
      setTodoContextMenu({ show: false, x: 0, y: 0, item: null });
      setTextContextMenu({ show: false, x: 0, y: 0, selection: null });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    setSelectedImage(null);
    setImagePreview(null);
  }, [activeTab]);

  useEffect(() => {
    if (textareaRef.current && textareaRef.current instanceof HTMLDivElement) {
      const currentText = activeTab === 'important' ? importantText : comfortableText;
      if (textareaRef.current.innerHTML !== currentText) {
        textareaRef.current.innerHTML = currentText || '';
      }
    }
  }, [importantText, comfortableText, activeTab]);

  // Important 텍스트 Firestore 불러오기
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);
    const docRef = doc(db, 'important', currentUser.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setImportantText(data.text || '');
      } else {
        setImportantText('');
      }
      setLoading(false);
    }, (error) => {
      console.error("Important 데이터 불러오기 오류:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Comfortable 텍스트 Firestore 불러오기
  useEffect(() => {
    if (!currentUser?.uid) return;

    const docRef = doc(db, 'comfortable', currentUser.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setComfortableText(data.text || '');
      } else {
        setComfortableText('');
      }
    }, (error) => {
      console.error("Comfortable 데이터 불러오기 오류:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // TodoList Firestore 불러오기 (날짜별)
  useEffect(() => {
    if (!currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDailyData({
          todolist: data.todolist || [],
        });
      } else {
        setDailyData({ todolist: [] });
      }
    }, (error) => {
      console.error("TodoList 데이터 불러오기 오류:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, formattedDate]);

  // Important 텍스트 자동 저장 (debounce)
  useEffect(() => {
    if (!currentUser?.uid) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'important', currentUser.uid);
        await setDoc(docRef, { text: importantText }, { merge: true });
      } catch (error) {
        console.error("Important 자동 저장 실패:", error);
      }
    }, 1000); // 1초 debounce

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [importantText, currentUser?.uid]);

  // Comfortable 텍스트 자동 저장 (debounce)
  useEffect(() => {
    if (!currentUser?.uid) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'comfortable', currentUser.uid);
        await setDoc(docRef, { text: comfortableText }, { merge: true });
      } catch (error) {
        console.error("Comfortable 자동 저장 실패:", error);
      }
    }, 1000); // 1초 debounce

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [comfortableText, currentUser?.uid]);

  const handleAddTodo = async () => {
    if (!newTodo.trim() || !currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    const newItem: TodoItem = {
      id: Date.now().toString(),
      text: newTodo,
      completed: false,
      bold: false,
      color: '#000000'
    };

    setNewTodo('');

    try {
      const docSnap = await getDoc(docRef);
      const currentTodos = docSnap.exists() ? (docSnap.data().todolist || []) : [];
      const updatedTodos = [...currentTodos, newItem];

      if (!docSnap.exists()) {
        await setDoc(docRef, { 
          todolist: updatedTodos 
        });
      } else {
        await updateDoc(docRef, { todolist: updatedTodos });
      }
    } catch (error) {
      console.error("투두 추가 실패:", error);
    }
  };

  const handleRemoveTodo = async (item: TodoItem) => {
    if (!currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    const updatedTodos = dailyData.todolist.filter(todo => todo.id !== item.id);

    try {
      await updateDoc(docRef, { todolist: updatedTodos });
    } catch (error) {
      console.error("투두 삭제 실패:", error);
    }
  };

  const handleToggleTodo = async (todoItem: TodoItem) => {
    if (!currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    const updatedList = dailyData.todolist.map(item =>
      item.id === todoItem.id ? { ...item, completed: !item.completed } : item
    );

    try {
      await updateDoc(docRef, { todolist: updatedList });
    } catch (error) {
      console.error("투두 상태 변경 실패:", error);
    }
  };

  const handleEditTodo = (item: TodoItem) => {
    setEditingTodoId(item.id);
    setEditingTodoText(item.text);
  };

  const handleSaveEditTodo = async () => {
    if (!editingTodoId || !currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    const updatedList = dailyData.todolist.map(item =>
      item.id === editingTodoId ? { ...item, text: editingTodoText } : item
    );

    try {
      await updateDoc(docRef, { todolist: updatedList });
      setEditingTodoId(null);
      setEditingTodoText('');
    } catch (error) {
      console.error("투두 수정 실패:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditingTodoText('');
  };

  const handleDragStart = (item: TodoItem) => {
    setDraggedTodo(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetItem: TodoItem) => {
    if (!draggedTodo || !currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    
    const draggedIndex = dailyData.todolist.findIndex(item => item.id === draggedTodo.id);
    const targetIndex = dailyData.todolist.findIndex(item => item.id === targetItem.id);

    if (draggedIndex === targetIndex) {
      setDraggedTodo(null);
      return;
    }

    const newList = [...dailyData.todolist];
    newList.splice(draggedIndex, 1);
    newList.splice(targetIndex, 0, draggedTodo);

    try {
      await updateDoc(docRef, { todolist: newList });
      setDraggedTodo(null);
    } catch (error) {
      console.error("순서 변경 실패:", error);
    }
  };

  const handleToggleTodoBold = async () => {
    if (!todoContextMenu.item || !currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    const updatedList = dailyData.todolist.map(item =>
      item.id === todoContextMenu.item!.id ? { ...item, bold: !item.bold } : item
    );

    try {
      await updateDoc(docRef, { todolist: updatedList });
      setTodoContextMenu({ show: false, x: 0, y: 0, item: null });
    } catch (error) {
      console.error("굵기 변경 실패:", error);
    }
  };

  const handleChangeTodoColor = async (color: string) => {
    if (!colorPickerTarget.item || !currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    const updatedList = dailyData.todolist.map(item =>
      item.id === colorPickerTarget.item!.id ? { ...item, color } : item
    );

    try {
      await updateDoc(docRef, { todolist: updatedList });
      setColorPickerOpen(false);
      setColorPickerTarget({ type: null, item: null, textSelection: null });
    } catch (error) {
      console.error("색상 변경 실패:", error);
    }
  };

  const handleMoveToTomorrow = async () => {
    if (!todoContextMenu.item || !currentUser?.uid || !formattedDate) return;

    const tomorrow = new Date(selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = formatDate(tomorrow);

    const collectionName = `phrase+${currentUser.uid}`;
    const todayDocRef = doc(db, collectionName, formattedDate);
    const tomorrowDocRef = doc(db, collectionName, tomorrowDate);

    try {
      const todayTodos = dailyData.todolist.filter(todo => todo.id !== todoContextMenu.item!.id);
      
      const tomorrowDocSnap = await getDoc(tomorrowDocRef);
      const tomorrowTodos = tomorrowDocSnap.exists() ? (tomorrowDocSnap.data().todolist || []) : [];

      await updateDoc(todayDocRef, { todolist: todayTodos });
      
      if (!tomorrowDocSnap.exists()) {
        await setDoc(tomorrowDocRef, {
          todolist: [...tomorrowTodos, todoContextMenu.item]
        });
      } else {
        await updateDoc(tomorrowDocRef, { todolist: [...tomorrowTodos, todoContextMenu.item] });
      }
      
      setTodoContextMenu({ show: false, x: 0, y: 0, item: null });
    } catch (error) {
      console.error("내일로 이동 실패:", error);
    }
  };

  const handleTextColorChange = (color: string) => {
    if (!colorPickerTarget.textSelection) return;

    const { text, tab } = colorPickerTarget.textSelection;
    const currentText = tab === 'important' ? importantText : comfortableText;
    const setText = tab === 'important' ? setImportantText : setComfortableText;
    
    const wrappedText = `<span style="color:${color}">${text}</span>`;
    
    if (currentText.includes(text)) {
      const newText = currentText.replace(text, wrappedText);
      setText(newText);
    }
    
    setColorPickerOpen(false);
    setColorPickerTarget({ type: null, item: null, textSelection: null });
  };

  const handleImageSelect = (file: File) => {
    if (!file) return;
    
    setSelectedImage(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOCRProcess = async () => {
    if (!selectedImage || !currentUser?.uid) return;

    setIsProcessingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const apiUrl = process.env.NEXT_PUBLIC_MEMO_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/ocr`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('OCR 처리 실패');
      }

      const responseData = await response.json();
      const ocrText = responseData.text || '';
      
      if (ocrText && ocrText.trim()) {
        if (activeTab === 'important') {
          const newText = importantText + (importantText ? '\n\n' : '') + ocrText;
          setImportantText(newText);
        } else if (activeTab === 'comfortable') {
          const newText = comfortableText + (comfortableText ? '\n\n' : '') + ocrText;
          setComfortableText(newText);
        }
        alert(`OCR 텍스트가 추가되었습니다! (${ocrText.length}자)`);
      } else {
        alert('이미지에서 텍스트를 찾을 수 없습니다.');
      }

      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('이미지 처리 오류:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleScheduleGeneration = async () => {
    if (!selectedImage || !currentUser?.uid) return;

    setIsProcessingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const apiUrl = process.env.NEXT_PUBLIC_MEMO_API_URL || 'http://localhost:8080';
      const ocrResponse = await fetch(`${apiUrl}/api/ocr`, {
        method: 'POST',
        body: formData,
      });

      if (!ocrResponse.ok) {
        throw new Error('OCR 처리 실패');
      }

      const ocrData = await ocrResponse.json();
      const text = ocrData.text || '';
      
      if (!text || !text.trim()) {
        alert('이미지에서 텍스트를 찾을 수 없습니다.');
        return;
      }

      await generateScheduleFromText(text);

      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('이미지 처리 오류:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const generateScheduleFromText = async (text: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_MEMO_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/generate-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('일정 생성 실패');
      }

      const responseData = await response.json();
      const schedules = responseData.schedules || [];
      
      if (schedules && schedules.length > 0) {
        const newItems: TodoItem[] = schedules.map((schedule: string, index: number) => ({
          id: `${Date.now()}-${index}`,
          text: schedule,
          completed: false,
          bold: false,
          color: '#000000'
        }));

        const collectionName = `phrase+${currentUser.uid}`;
        const docRef = doc(db, collectionName, formattedDate);
        const docSnap = await getDoc(docRef);
        const currentTodos = docSnap.exists() ? (docSnap.data().todolist || []) : [];
        const updatedTodos = [...currentTodos, ...newItems];

        if (!docSnap.exists()) {
          await setDoc(docRef, { 
            todolist: updatedTodos 
          });
        } else {
          await updateDoc(docRef, { todolist: updatedTodos });
        }
        
        alert(`${schedules.length}개의 일정이 추가되었습니다!`);
      } else {
        alert('생성된 일정이 없습니다.');
      }
    } catch (error) {
      console.error('일정 생성 오류:', error);
      alert('일정 생성 중 오류가 발생했습니다.');
    }
  };

  const suggestScheduleFromText = async (text: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_MEMO_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/suggest-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('일정 제안 실패');
      }

      const responseData = await response.json();
      const schedules = responseData.schedules || [];
      
      setSuggestedSchedules(schedules);
      setShowScheduleSuggestion(schedules.length > 0);
      
      if (schedules.length === 0) {
        alert('텍스트에서 일정을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('일정 제안 오류:', error);
      alert('일정 제안 중 오류가 발생했습니다.');
    }
  };

  const addSuggestedSchedule = async (schedule: string) => {
    if (!currentUser?.uid || !formattedDate) return;

    const collectionName = `phrase+${currentUser.uid}`;
    const docRef = doc(db, collectionName, formattedDate);
    const newItem: TodoItem = {
      id: Date.now().toString(),
      text: schedule,
      completed: false,
      bold: false,
      color: '#000000'
    };

    try {
      const docSnap = await getDoc(docRef);
      const currentTodos = docSnap.exists() ? (docSnap.data().todolist || []) : [];
      const updatedTodos = [...currentTodos, newItem];

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          todolist: updatedTodos
        });
      } else {
        await updateDoc(docRef, { todolist: updatedTodos });
      }

      setSuggestedSchedules(prev => prev.filter(s => s !== schedule));
      if (suggestedSchedules.length <= 1) {
        setShowScheduleSuggestion(false);
      }
    } catch (error) {
      console.error("일정 추가 실패:", error);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return isSameDay(date, today);
  };

  const colors = [
    { color: '#000000', name: '검정색' },
    { color: '#FF0000', name: '빨간색' },
    { color: '#0066FF', name: '파란색' },
    { color: '#00CC44', name: '초록색' },
    { color: '#FFD700', name: '노란색' },
    { color: '#FF8C00', name: '주황색' },
    { color: '#808080', name: '그레이' },
    { color: '#FF1493', name: '핑크' },
    { color: '#9370DB', name: '보라색' },
    { color: '#00CED1', name: '청록색' },
    { color: '#32CD32', name: '라임' },
    { color: '#FFB6C1', name: '연분홍' },
    { color: '#8B4513', name: '갈색' },
    { color: '#4169E1', name: '로얄블루' },
    { color: '#FF6347', name: '토마토' },
    { color: '#FFFFFF', name: '하얀색' }
  ];

  const renderCalendar = () => {
    const days = getDaysInMonth(currentMonth);
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    return (
      <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h3 className="text-2xl font-bold text-gray-900">
            {currentMonth.getFullYear()}년 {monthNames[currentMonth.getMonth()]}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-gray-600 font-semibold py-2 text-sm">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (day) {
                  setSelectedDate(day);
                  setShowCalendar(false);
                }
              }}
              disabled={!day}
              className={`
                aspect-square p-2 rounded-xl text-center font-medium transition-all
                ${!day ? 'invisible' : ''}
                ${isSameDay(day, selectedDate) ? 'bg-blue-500 text-white shadow-lg scale-105' : 'text-gray-700 hover:bg-gray-100'}
                ${isToday(day) && !isSameDay(day, selectedDate) ? 'border-2 border-blue-500' : ''}
              `}
            >
              {day?.getDate()}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const renderContent = () => {
    if (activeTab === 'important' || activeTab === 'comfortable') {
      const text = activeTab === 'important' ? importantText : comfortableText;
      const setText = activeTab === 'important' ? setImportantText : setComfortableText;

      return (
        <div className="bg-white border-2 border-gray-300 rounded-xl p-6 space-y-4 min-h-[500px]">
          <div className="relative">
            {!text && (
              <div className="absolute top-0 left-0 px-4 py-3 text-gray-400 pointer-events-none">
                여기에 메모를 작성하세요... (자동 저장됩니다)
              </div>
            )}
            <div
              ref={textareaRef as any}
              contentEditable
              suppressContentEditableWarning
              onPaste={handlePaste}
              onInput={(e) => {
                const htmlContent = e.currentTarget.innerHTML;
                if (htmlContent === '<br>' || htmlContent === '<br/>' || htmlContent.trim() === '') {
                  setText('');
                } else {
                  setText(htmlContent);
                }
              }}
              onContextMenu={(e) => {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                  e.preventDefault();
                  const selectedText = selection.toString();
                  
                  const container = e.currentTarget;
                  const htmlContent = container.innerHTML;
                  const start = htmlContent.indexOf(selectedText);
                  const end = start + selectedText.length;
                  
                  if (start !== -1) {
                    setTextContextMenu({
                      show: true,
                      x: e.clientX,
                      y: e.clientY,
                      selection: { start, end, text: selectedText }
                    });
                  }
                }
              }}
              className="w-full min-h-[400px] bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto resize-y"
              style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
            />
          </div>

          {imagePreview && (
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <div className="flex gap-4">
                <img 
                  src={imagePreview} 
                  alt="선택된 이미지" 
                  className="w-32 h-32 object-cover rounded-lg"
                />
                <div className="flex flex-col gap-2 justify-center">
                  <Button
                    onClick={handleOCRProcess}
                    disabled={isProcessingImage}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  >
                    {isProcessingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {isProcessingImage ? 'OCR 처리 중...' : 'OCR로 가져오기'}
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white"
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="bg-gray-700 hover:bg-gray-800 text-white gap-2"
              >
                <Camera className="w-4 h-4" />
                사진으로 글 추가
              </Button>
              {activeTab === 'comfortable' && comfortableText.trim() && (
                <Button
                  onClick={() => suggestScheduleFromText(comfortableText)}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  일정을 만들어드릴까요?
                </Button>
              )}
            </div>
            <div className="text-sm text-gray-500">
              자동 저장 중...
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border-2 border-gray-300 rounded-xl p-6 space-y-4 min-h-[500px]">
        <div className="space-y-3">
          {dailyData.todolist.length > 0 ? dailyData.todolist.map(item => (
            <div
              key={item.id}
              draggable={isReorderMode}
              onDragStart={() => handleDragStart(item)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(item)}
              onContextMenu={(e) => {
                if (!isReorderMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  setTodoContextMenu({ show: true, x: e.clientX, y: e.clientY, item });
                }
              }}
              className={`flex items-start gap-3 p-3 rounded-md group cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 ${isReorderMode ? 'cursor-move' : ''}`}
            >
              {editingTodoId === item.id ? (
                <>
                  <input
                    type="text"
                    value={editingTodoText}
                    onChange={(e) => setEditingTodoText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEditTodo()}
                    className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900"
                    autoFocus
                  />
                  <button onClick={handleSaveEditTodo} className="text-green-600 hover:text-green-700">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleToggleTodo(item)} className="flex-shrink-0 mt-1">
                    <CheckSquare className={`w-5 h-5 transition-colors ${item.completed ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`} />
                  </button>
                  <p
                    className={`flex-1 ${item.bold ? 'font-bold' : ''} ${item.completed ? 'line-through' : ''}`}
                    style={{ color: item.completed ? '#9ca3af' : (item.color || '#000000') }}
                  >
                    {item.text}
                  </p>
                  {!isReorderMode && (
                    <button onClick={() => handleRemoveTodo(item)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          )) : (
            <p className="text-sm text-gray-500 text-center py-8">일정이 없습니다.</p>
          )}
        </div>

        {imagePreview && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
            <div className="flex gap-4">
              <img 
                src={imagePreview} 
                alt="선택된 이미지" 
                className="w-32 h-32 object-cover rounded-lg"
              />
              <div className="flex flex-col gap-2 justify-center">
                <Button
                  onClick={handleScheduleGeneration}
                  disabled={isProcessingImage}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {isProcessingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  {isProcessingImage ? '일정 생성 중...' : '일정 생성'}
                </Button>
                <Button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                >
                  취소
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
              placeholder="새 일정 추가..."
              className="flex-1 bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleAddTodo} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`${isReorderMode ? 'bg-blue-600' : 'bg-gray-700'} hover:bg-gray-800 text-white gap-2`}
            >
              <ArrowRight className={`w-4 h-4 ${isReorderMode ? 'rotate-90' : ''} transition-transform`} />
              {isReorderMode ? '순서 변경 완료' : '순서 바꾸기'}
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingImage}
              className="bg-gray-700 hover:bg-gray-800 text-white gap-2"
            >
              <Camera className="w-4 h-4" />
              사진에서 일정 생성
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 md:p-6 py-6 overflow-auto w-full bg-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageSelect(file);
          }
          if (e.target) {
            e.target.value = '';
          }
        }}
        className="hidden"
      />
      <div className="max-w-5xl lg:max-w-7xl xl:max-w-screen-2xl 2xl:max-w-full mx-auto px-2 md:px-0 space-y-6">
        <div className="bg-white border-2 border-gray-300 rounded-xl p-4">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full flex items-center justify-between text-gray-900 hover:text-gray-700 transition-colors"
          >
            <span className="text-xl font-semibold">
              {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일
            </span>
            <ChevronDown className={`w-6 h-6 transition-transform ${showCalendar ? 'rotate-180' : ''}`} />
          </button>

          {showCalendar && (
            <div className="mt-4">
              {renderCalendar()}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => setActiveTab('important')}
            className={`flex-1 gap-2 ${activeTab === 'important' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            <Star className="w-5 h-5" />
            중요 문구
          </Button>
          <Button
            onClick={() => setActiveTab('comfortable')}
            className={`flex-1 gap-2 ${activeTab === 'comfortable' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            <FileText className="w-5 h-5" />
            생각 문구
          </Button>
          <Button
            onClick={() => setActiveTab('todolist')}
            className={`flex-1 gap-2 ${activeTab === 'todolist' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            <CheckSquare className="w-5 h-5" />
            일정
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-8 h-8 text-gray-900 animate-spin" />
          </div>
        ) : (
          renderContent()
        )}

        {todoContextMenu.show && (
          <div
            className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-xl py-2 z-50"
            style={{ left: todoContextMenu.x, top: todoContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                handleEditTodo(todoContextMenu.item!);
                setTodoContextMenu({ show: false, x: 0, y: 0, item: null });
              }}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2"
            >
              <Type className="w-4 h-4" />
              수정하기
            </button>
            <button
              onClick={() => {
                handleToggleTodo(todoContextMenu.item!);
                setTodoContextMenu({ show: false, x: 0, y: 0, item: null });
              }}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              일정 완료
            </button>
            <button
              onClick={handleToggleTodoBold}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2"
            >
              <Type className="w-4 h-4" />
              글씨 굵게
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setColorPickerTarget({ 
                  type: 'todo',
                  item: todoContextMenu.item 
                });
                setColorPickerOpen(true);
                setTodoContextMenu({ show: false, x: 0, y: 0, item: null });
              }}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2"
            >
              <Palette className="w-4 h-4" />
              색 변경
            </button>
            <button
              onClick={handleMoveToTomorrow}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              내일로 옮기기
            </button>
          </div>
        )}

        {textContextMenu.show && (
          <div
            className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-xl py-2 z-50"
            style={{ left: textContextMenu.x, top: textContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (!textContextMenu.selection) return;
                
                const currentText = activeTab === 'important' ? importantText : comfortableText;
                const setText = activeTab === 'important' ? setImportantText : setComfortableText;
                const { text } = textContextMenu.selection;
                
                const wrappedText = `<b>${text}</b>`;
                
                if (currentText.includes(text)) {
                  const newText = currentText.replace(text, wrappedText);
                  setText(newText);
                }
                
                setTextContextMenu({ show: false, x: 0, y: 0, selection: null });
              }}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2"
            >
              <Type className="w-4 h-4" />
              글씨 굵게
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setColorPickerTarget({ 
                  type: 'text',
                  item: null,
                  textSelection: textContextMenu.selection ? {
                    ...textContextMenu.selection,
                    tab: activeTab as 'important' | 'comfortable'
                  } : null
                });
                setColorPickerOpen(true);
                setTextContextMenu({ show: false, x: 0, y: 0, selection: null });
              }}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 flex items-center gap-2"
            >
              <Palette className="w-4 h-4" />
              색 변경
            </button>
          </div>
        )}

        <Dialog open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <DialogContent className="bg-white border-2 border-gray-300 text-gray-900 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold">🎨 색상 선택</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-4 p-6">
              {colors.map(colorItem => (
                <div key={colorItem.color} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => {
                      if (colorPickerTarget.type === 'todo') {
                        handleChangeTodoColor(colorItem.color);
                      } else if (colorPickerTarget.type === 'text') {
                        handleTextColorChange(colorItem.color);
                      }
                    }}
                    className="w-16 h-16 rounded-lg border-2 hover:border-blue-600 transition-all hover:scale-110 shadow-lg"
                    style={{ 
                      backgroundColor: colorItem.color,
                      borderColor: colorItem.color === '#FFFFFF' ? '#d1d5db' : '#9ca3af'
                    }}
                    title={colorItem.name}
                  />
                  <span className="text-xs text-gray-600">{colorItem.name}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {showScheduleSuggestion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">일정 제안</h3>
              <div className="space-y-2 mb-4">
                {suggestedSchedules.map((schedule, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="text-gray-900 flex-1">{schedule}</span>
                    <Button
                      onClick={() => addSuggestedSchedule(schedule)}
                      className="bg-blue-600 hover:bg-blue-700 text-white ml-2"
                      size="sm"
                    >
                      추가
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setShowScheduleSuggestion(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                >
                  닫기
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}