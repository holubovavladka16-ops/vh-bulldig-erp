# VH Bulldig ERP - Test Credentials

## Admin Account
- **Email**: test@vhbulldig.cz
- **Password**: Test123456
- **Role**: Administrator

## Application URL
- **Local**: http://localhost:5174
- **Network**: http://172.16.116.114:5174

## Testing Checklist

### Authentication
- [ ] Login with test credentials
- [ ] Logout functionality
- [ ] Password reset flow

### Dashboard
- [ ] Dashboard loads correctly
- [ ] KPI cards display data
- [ ] Quick links work
- [ ] Module navigation works

### Workers Module
- [ ] Create new worker
- [ ] Edit worker details
- [ ] Upload worker photo
- [ ] View worker personal card
- [ ] Archive/restore worker
- [ ] Delete worker
- [ ] Generate portal link

### Attendance Module
- [ ] Create manual attendance record
- [ ] Edit attendance record
- [ ] Delete attendance record
- [ ] Filter by worker, order, date
- [ ] Export PDF
- [ ] Export Excel

### Daily Forms & Employee Portal
- [ ] Access employee portal via token
- [ ] Submit daily form
- [ ] Add work items
- [ ] Upload photos
- [ ] Sign form
- [ ] View my attendance
- [ ] View my reports
- [ ] View earnings summary

### Reports Module
- [ ] View reports list
- [ ] Filter reports
- [ ] Export reports

### PDF Generation
- [ ] Diary report (A4, Czech chars, logo, watermark)
- [ ] Photo report (A4, GPS, map)
- [ ] Receipt report
- [ ] Profit overview report
- [ ] Attendance report
- [ ] Payroll slip

### GPS Photos Module
- [ ] Capture photo with GPS
- [ ] View photo gallery
- [ ] Map view with photo markers
- [ ] Filter photos
- [ ] Share via WhatsApp
- [ ] Share via Messenger
- [ ] Share via Email

### Maps Integration
- [ ] Google Maps links work
- [ ] Mapy.cz links work
- [ ] Street View links work
- [ ] Static map images load

### Route Measurement (Excavation Map)
- [ ] Manual drawing mode
- [ ] GPS walk measurement
- [ ] Address route measurement
- [ ] Save route to order
- [ ] Edit route
- [ ] Delete route
- [ ] Export route PDF

### Construction Diary
- [ ] Create diary entry
- [ ] Edit diary entry
- [ ] Delete diary entry
- [ ] View diary detail
- [ ] Export single entry PDF
- [ ] Export bulk diary PDF
- [ ] Filter by order, date

### Orders Module
- [ ] Create order
- [ ] Edit order
- [ ] Archive order
- [ ] Delete order
- [ ] View order details
- [ ] Filter orders

### Economy/Costs Module
- [ ] Add cost entry
- [ ] Edit cost entry
- [ ] Delete cost entry
- [ ] Upload receipt
- [ ] View cost list

### Profit Overview
- [ ] View profit summary
- [ ] Filter by order, date
- [ ] Add invoice
- [ ] Export PDF
- [ ] Export Excel

### Utility Connections (Přípojky)
- [ ] Create connection
- [ ] Edit connection
- [ ] Delete connection
- [ ] Upload photos
- [ ] View connection detail

### Mobile Responsiveness
- [ ] Test on mobile viewport
- [ ] Sidebar collapses correctly
- [ ] Touch targets work
- [ ] Forms are usable on mobile

### RLS Policies
- [ ] Admin can access all data
- [ ] Non-admin users restricted
- [ ] Portal token validation works

## Notes
- The application is running on port 5174 (5173 was in use)
- Supabase connection verified (16/16 modules OK)
- Build completed successfully
- All database migrations applied
