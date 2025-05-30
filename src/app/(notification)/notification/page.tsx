"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { FaTrashAlt } from "react-icons/fa";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [filter, setFilter] = useState("all");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("userId"); // Grab userId
    setUserId(id); // Set it in state
    if (!id) {
      console.error("User ID not found");
      return;
    }

    const URL = process.env.NEXT_PUBLIC_URL
    const socket = new SockJS(`${URL}/ws`)
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);

    if (!token) {
      setLoading(false);
      return;
    }

    fetchNotifications();

    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("✅ WebSocket connected");
        client.subscribe(`/queue/notifications/${id}`, (message) => {
          const newNotif = JSON.parse(message.body);
          setNotifications((prev) => {
            if (prev.some((notif) => notif.id === newNotif.id)) {
              return prev;
            }
            return [...prev, newNotif];
          });
        });
        setIsConnected(true);
      },
      onStompError: (frame) => {
        console.error("STOMP Error:", frame);
        setIsConnected(false);
      },
      onWebSocketClose: () => {
        console.warn("🔌 WebSocket disconnected");
        setIsConnected(false);
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [userId]); // Run again when userId changes

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const userId = localStorage.getItem("userId");

      if (!userId) {
        toast.error("User ID not found");
        return;
      }

      const response = await fetch(`${API_URL}/notifications/user/${userId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok && response.status !== 204) {
        throw new Error("Failed to fetch notifications");
      }

      if (response.status !== 204) {
        const data = await response.json();

        if (data.length === 0) {
          toast.info("No notifications available");
        } else {
          setNotifications(data);
        }
      } else {
        toast.error("No notifications available");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("Token not valid");
        return;
      }

      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        setNotifications((prevNotifications) =>
          prevNotifications.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification,
          ),
        );
        toast.success("Notification marked as read");
      } else {
        throw new Error("Failed to mark notification as read");
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to mark notification as read");
    }
  };

  const handleViewNotification = (notificationId: string) => {
    router.push(`/notification/${notificationId}`);
    handleMarkAsRead(notificationId);
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("Token not valid");
        return;
      }

      const response = await fetch(
        `${API_URL}/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        setNotifications((prevNotifications) =>
          prevNotifications.filter(
            (notification) => notification.id !== notificationId,
          ),
        );
        toast.success("Notification deleted");
      } else {
        throw new Error("Failed to delete notification");
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const handleFilterChange = (filter: string) => {
    setFilter(filter);
  };

  if (!isLoggedIn) {
    return (
      <>
        <Header />
        <div className="flex flex-col items-center justify-center p-10 min-h-[50vh] text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Akses Terbatas
          </h2>
          <p className="text-gray-600 mb-6">
            Silakan login terlebih dahulu untuk melihat notifikasi Anda.
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Login
          </Button>
        </div>
        <Footer />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="p-10 text-center">Memuat notifikasi...</div>
        <Footer />
      </>
    );
  }

  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((notification) =>
          filter === "read" ? notification.read : !notification.read,
        );

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto p-6 min-h-screen">
        <h1 className="text-3xl font-bold text-green-700 mb-6">
          Notifikasi Anda
        </h1>
        <div className="mb-4">
          <Button
            onClick={() => handleFilterChange("all")}
            className={`mr-2 ${filter === "all" ? "bg-green-600" : ""}`}
          >
            Semua
          </Button>
          <Button
            onClick={() => handleFilterChange("read")}
            className={`mr-2 ${filter === "read" ? "bg-green-600" : ""}`}
          >
            Dibaca
          </Button>
          <Button
            onClick={() => handleFilterChange("unread")}
            className={`mr-2 ${filter === "unread" ? "bg-green-600" : ""}`}
          >
            Belum Dibaca
          </Button>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="text-center p-10 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Anda tidak memiliki notifikasi.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`overflow-hidden ${notification.read ? "bg-gray-100" : "bg-white"} hover:shadow-lg transition-shadow cursor-pointer`}
                onClick={() => handleViewNotification(notification.id)}
              >
                <CardContent className="p-4 flex justify-between items-end h-full">
                  <div>
                    <h2 className="text-xl font-semibold text-green-700">
                      {notification.title}
                    </h2>
                    <p className="text-sm text-gray-600 mb-2">
                      {notification.message}
                    </p>
                  </div>
                  <div className="mt-2">
                    <Button
                      className="w-8 h-8 p-0 bg-red-500 text-white"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent the card click event
                        handleDeleteNotification(notification.id);
                      }}
                    >
                      <FaTrashAlt />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
