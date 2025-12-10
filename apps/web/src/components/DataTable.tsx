'use client';

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { ParsedRegulation } from '@/types/regulation';

const columnHelper = createColumnHelper<ParsedRegulation>();

const columns = [
  columnHelper.accessor('title', {
    header: 'Title',
    size: 200,
    cell: (info) => (
      <div className="font-semibold text-sm text-gray-900 line-clamp-2">{info.getValue()}</div>
    ),
  }),
  columnHelper.accessor('num_flags', {
    header: '# Flags',
    size: 70,
    cell: (info) => (
      <span className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
        {info.getValue() || '0'}
      </span>
    ),
  }),
  columnHelper.accessor('categories', {
    header: 'Categories',
    size: 180,
    cell: (info) => (
      <div className="text-xs text-gray-700 line-clamp-2">{info.getValue() || '–'}</div>
    ),
  }),
  columnHelper.accessor('explanations', {
    header: 'Explanations',
    size: 300,
    cell: (info) => {
      const text = info.getValue() || '';
      return (
        <div className="text-xs text-gray-700 line-clamp-3">
          {text || '–'}
        </div>
      );
    },
  }),
  columnHelper.accessor('has_implementation_issues', {
    header: 'Impl Issues',
    size: 80,
    cell: (info) => <span className="text-gray-900">{info.getValue() === 'True' ? '✓' : '–'}</span>,
  }),
  columnHelper.accessor('overall_complexity', {
    header: 'Complexity',
    size: 90,
    cell: (info) => <span className="text-gray-900 font-medium">{info.getValue() || '–'}</span>,
  }),
  columnHelper.accessor('max_severity', {
    header: 'Severity',
    size: 80,
    cell: (info) => {
      const severity = info.getValue();
      const colorClass = severity === '9' || severity === '8'
        ? 'text-red-600 font-bold'
        : severity === '7' || severity === '6'
        ? 'text-orange-500 font-bold'
        : 'text-green-600';
      return <span className={colorClass}>{severity || '–'}</span>;
    },
  }),
  columnHelper.accessor('requires_technical_review', {
    header: 'Tech Review',
    size: 85,
    cell: (info) => <span className="text-gray-900">{info.getValue() === 'True' ? '✓' : '–'}</span>,
  }),
  columnHelper.accessor('has_reporting_requirement', {
    header: 'Reporting',
    size: 80,
    cell: (info) => <span className="text-gray-900">{info.getValue() === 'True' ? '✓' : '–'}</span>,
  }),
  columnHelper.accessor('summary', {
    header: 'Summary',
    size: 350,
    cell: (info) => {
      const text = info.getValue() || '';
      return (
        <div className="text-xs text-gray-700 line-clamp-3">
          {text || '–'}
        </div>
      );
    },
  }),
];

interface DataTableProps {
  data: ParsedRegulation[];
  onRowClick: (regulation: ParsedRegulation) => void;
}

export default function DataTable({ data, onRowClick }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'max_severity', desc: true },
  ]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  return (
    <div className="w-full">
      <div className="overflow-x-auto border rounded-lg">
        <table className="divide-y divide-gray-200 text-gray-900 table-fixed w-full" style={{ minWidth: '1400px' }}>
          <thead className="bg-blue-600">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? ''}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="px-3 py-2 align-top overflow-hidden"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              data.length
            )}{' '}
            of {data.length} entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
