import ChatInterface from "@/components/ChatInterface";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatConvPage({ params }: Props) {
  const { id } = await params;
  return <ChatInterface userId="" convIdFromUrl={id} />;
}
