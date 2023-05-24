import { useRef } from 'react';

import { v4 as uuid } from 'uuid';

import { store } from '@/store';
import { removeMessageUpTo, selectChatById } from '@/store/chatsSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    addMessage,
    selectChatMessages,
    selectMessageById,
    setIsLoading,
    updateMessage,
} from '@/store/messagesSlice';
import { getApiKey } from '@/store/settingSlice';
import { Message } from '@/types';
import { errorMessage } from '@/utils/config';
interface UseChatResult {
    // generatedMessage: string;
    // isLoading: boolean;
    generateReply: (userInput: string) => void;
    regenerate: () => void;
    setStopGenerating: () => void;
}
interface Props {
    chatId: string;
}

export default function useChat({ chatId }: Props): UseChatResult {
    const stopGeneratingRef = useRef<boolean>(false);
    const apiKey = useAppSelector(getApiKey);
    const dispatch = useAppDispatch();
    const setStopGenerating = () => {
        stopGeneratingRef.current = true;
    };
    const regenerate = async () => {
        const currentChat = selectChatById(store.getState(), chatId);
        const lastUserMessageId = currentChat?.messages[currentChat.messages.length - 2];
        if (lastUserMessageId) {
            const lastUserMessage = selectMessageById(store.getState(), lastUserMessageId);
            dispatch(removeMessageUpTo({ messageId: lastUserMessageId }));
            if (lastUserMessage) generateReply(lastUserMessage.content);
        }
    };

    const generateReply = async (userInput: string) => {
        const userMessage: Message = {
            id: uuid(),
            chatId,
            created: Date.now(),
            role: 'user',
            content: userInput,
        };
        dispatch(addMessage(userMessage));

        const chat = selectChatById(store.getState(), chatId);
        const OpenAIMessages = selectChatMessages(store.getState(), chatId);
        const response = await fetch('/api/generateReply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chat, OpenAIMessages, apiKey }),
        });
        console.log(`in useChat: ${JSON.stringify(chat?.messages)}`);

        const reply: Message = {
            id: uuid(),
            chatId,
            created: Date.now(),
            role: 'assistant',
            content: '',
            isFirst: chat?.messages.length === 1 ? true : false, // first api reply (for generating title)
        };
        dispatch(addMessage(reply));
        dispatch(setIsLoading({ status: true, messageId: reply.id }));

        if (!response.ok) {
            if (response.status === 401) {
                dispatch(
                    updateMessage({ messageId: reply.id, chunkValue: errorMessage.unauthorizedMsg })
                );
            } else if (response.status === 400) {
                dispatch(
                    updateMessage({ messageId: reply.id, chunkValue: errorMessage.badRequestMsg })
                );
            } else {
                dispatch(
                    updateMessage({ messageId: reply.id, chunkValue: errorMessage.serverErrorMsg })
                );
            }
            return;
        }

        // This data is a ReadableStream
        const data: ReadableStream<Uint8Array> | undefined | null = response.body;
        if (!data) {
            throw new Error('Server error');
        }
        const reader: ReadableStreamDefaultReader<Uint8Array> = data?.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
            if (stopGeneratingRef.current) {
                break;
            }
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            const chunkValue = decoder.decode(value);
            dispatch(updateMessage({ messageId: reply.id, chunkValue }));
        }
        dispatch(setIsLoading({ status: false, messageId: reply.id }));
        stopGeneratingRef.current = false;
    };

    return {
        // generatedMessage,
        // isLoading,
        generateReply,
        regenerate,
        setStopGenerating,
    };
}
