import { useParams } from "react-router-dom";
import ChatInterface from "@/components/chat/ChatInterface";

/** Altura útil: viewport − barra superior (4rem) − barra inferior no mobile (6rem). */
const ChatPage = () => {
  const { conversationId } = useParams();
  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] w-full max-w-4xl flex-col sm:px-6 sm:py-6 lg:h-[calc(100dvh-4rem)]">
      <ChatInterface conversationId={conversationId} />
    </div>
  );
};

export default ChatPage;
