import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = new URLSearchParams();
    Object.keys(body).forEach((key) => {
      params.append(key, body[key]);
    });

    const res = await fetch("https://atologistinfotech.com/api/register.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
      },
      body: params.toString(),
      redirect: "manual", 
    });

    const text = await res.text();
    const isHTML = text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html");
    let data: any = null;
    if (text && text.trim() && !isHTML) {
      try {
        data = JSON.parse(text);
      } catch {
      }
    }
    if (res.status === 200) {
      return NextResponse.json(
        {
          status: res.status,
          success: true,
          data: data || (isHTML ? null : text),
          rawText: isHTML ? null : text,
          isHTML: isHTML,
          message: isHTML 
            ? "Registration successful" 
            : (data?.message || "Account created successfully"),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: res.status,
        success: false,
        error: data?.error || data?.message || (isHTML ? "Server error" : text) || "Registration failed",
        data: data,
        rawText: text,
        isHTML: isHTML,
      },
      { status: res.status }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
