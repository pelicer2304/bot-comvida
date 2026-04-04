import * as React from "react";
import NextLink from 'next/link'; 
import ToDoList from "@/components/Apps/ToDoList";

export default function Page() {
  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb-card">
        <h5>To Do List</h5>

        <ul className="breadcrumb">
          <li>
            <NextLink href="/dashboard/ecommerce/">
              <i className="material-symbols-outlined">home</i>
              Dashboard
            </NextLink>
          </li>
          <li>Apps</li>
          <li>To Do List</li>
        </ul>
      </div>

      <ToDoList />
    </>
  );
}
