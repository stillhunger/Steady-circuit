
// 去除不需要显示连接的部分
Manager.LeaveOutIllegalMotiBody = function() {
	if (2 == Manager.motiCount		//同一物体的两个连接点不能显示连接
		&& Manager.motiBody[0].IsOnConnectPos() 
		&& Manager.motiBody[1].IsOnConnectPos()
		&& Manager.motiBody[0].IsBodySame(Manager.motiBody[1]))	{
		--Manager.motiCount;
		return false;
	}
	else if (2 == Manager.motiCount	//无意义操作
		&& Manager.motiBody[0].IsOnConnectPos()
		&& !Manager.motiBody[1].IsOnConnectPos() 
		&& !Manager.motiBody[1].IsOnLead()) {
		--Manager.motiCount;
		return false;
	}

	return true;
};
//传入鼠标坐标,传出是否在物体上,或物体的连接点上
Manager.MotivateAll = function(pos) {
	var mouseMoti = Manager.motiBody[Manager.motiCount];
	var i;

	//1,初始化-------------------------------------------
	ASSERT(Manager.motiCount >= 0 && Manager.motiCount < 2);
	mouseMoti.Clear();

	//2,搜索在什么物体上---------------------------------
	for (i = Manager.crun.length-1; i>=0; --i) {	//搜索所有结点
		mouseMoti.SetAtState(Manager.crun[i].At(pos.x, pos.y));
		if (mouseMoti.IsOnAny()) {
			mouseMoti.SetOnCrun(Manager.crun[i], false);
			++Manager.motiCount;
			return Manager.LeaveOutIllegalMotiBody();
		}
	}
	for (i = Manager.lead.length-1; i>=0; --i) {	//搜索所有导线
		mouseMoti.SetAtState(Manager.lead[i].At(pos.x, pos.y));
		if (mouseMoti.IsOnAny()) {
			mouseMoti.SetOnLead(Manager.lead[i], false);
			++Manager.motiCount;
			return Manager.LeaveOutIllegalMotiBody();
		}
	}
	for (i = Manager.ctrl.length-1; i>=0; --i) {	//搜索所有控件
		mouseMoti.SetAtState(Manager.ctrl[i].At(pos.x, pos.y));
		if (mouseMoti.IsOnAny()) {
			mouseMoti.SetOnCtrl(Manager.ctrl[i], false);
			++Manager.motiCount;
			return Manager.LeaveOutIllegalMotiBody();
		}
	}

	return false;	//运行到这里一定没有激活物体
};

//处理WM_LBUTTONDOWN消息
Manager.LButtonDown = function(pos) {
	if (!Manager.isUpRecvAfterDown) Manager.motiCount = 0;		//在上次鼠标左键按下后没有接受到鼠标按起消息
	Manager.lButtonDownState = Manager.MotivateAll(pos);	//记录这次鼠标是否点击了物体
	SetPosition(Manager.lButtonDownPos, pos);		//记录鼠标左键按下的坐标
	Manager.isUpRecvAfterDown = false;				//收到鼠标按起消息会设置为true
	Manager.lastMoveOnPos.x = -100;					//还原左击物体后,鼠标移动到的坐标

	//未点击有效部位,点击物体清除,帮助连接导线
	if (!Manager.lButtonDownState) {
		if (Manager.motiCount > 0 && Manager.motiBody[Manager.motiCount-1].IsOnConnectPos())
			Manager.PaintAll();	//覆盖ShowAddLead画的导线

		Manager.motiCount = 0;
		return false;
	//点击不在连接点
	} else if (!Manager.motiBody[Manager.motiCount-1].IsOnConnectPos()) {
		Manager.FocusBodyPaint(Manager.motiBody[Manager.motiCount-1]);	//重绘焦点物体
	}

	//第一个选定点是连接点
	if (2 == Manager.motiCount && Manager.motiBody[0].IsOnConnectPos()) {
		if (Manager.motiBody[1].IsOnConnectPos()) {
			Manager.AddLead(Manager.motiBody[0], Manager.motiBody[1]);	//编辑函数
		} else if (Manager.motiBody[1].IsOnLead()) {
			Manager.ConnectBodyLead(pos);
		}

		Manager.motiCount = 0;
		return true;
	}

	//AddLead处理了dira=1~4,dirb=1~4的消息;ConnectBodyLead(pos)处理了dira=1~4,dirb=-2~-3,...的消息.
	//dira=1~4,dirb=-1的消息不做处理,仅仅刷新
	//dira=-1,-2,-3,...的消息屏蔽掉(因为后面又点击了物体)
	//也就是LButtonUp只能处理1==Manager.motiCount,dira=-1,-2,-3,...的消息;

	if (2 == Manager.motiCount) Manager.motiCount = 0;
	return false;
};

//处理鼠标左键按起的消息
Manager.LButtonUp = function(pos, e) {
	Manager.isUpRecvAfterDown = true;						//鼠标按下后收到鼠标按起消息
	if (!Manager.lButtonDownState || Manager.motiCount<=0) return false;	//没有点击返回
	var body = Manager.motiBody[Manager.motiCount-1].Clone();

	//左键按下和按起的坐标相同,而且点击的不是连接点
	if (Manager.lButtonDownPos.x == pos.x && Manager.lButtonDownPos.y == pos.y && !body.IsOnConnectPos()) {
		if (body.IsOnCtrl())
			body.p.SwitchClosed(true);	//开关开合情况改变
		Manager.FocusBodyPaint(null);	//重绘焦点

		Manager.motiCount = 0;
		return false;
	}

	if (body.IsOnLead()) {	//移动导线
		body.p.Move(body.GetAtState(), pos, Manager.maxLeaveOutDis);
		Manager.motiCount = 0;
		return true;
	} else if (body.IsOnBody()) {	//移动物体或复制物体
		if (e.ctrlKey==1) 	//左或右Ctrl键按下复制物体
			Manager.PosBodyClone(body, Manager.lButtonDownPos, pos);
		else
			Manager.PosBodyMove(body, Manager.lButtonDownPos, pos);
		Manager.motiCount = 0;
		return true;
	} else if (!body.IsOnConnectPos()) {
		Manager.motiCount = 0;
		return false;
	}

	return false;
};

//鼠标移动消息处理e.button==0, e.ctrlKey==1
Manager.MouseMove = function(pos, e) {
	if (Manager.ShowAddBody(pos)) return;	//添加物体过程显示
	if (Manager.ShowMoveBody(pos, e.button==0, e.ctrlKey==1)) return;	//移动物体过程显示
	if (Manager.ShowMoveLead(e.button==0)) return;	//移动导线过程显示
	Manager.ShowAddLead(pos);	//连接导线过程显示

	//鼠标激活物体显示
	if (Manager.MotivateAll(pos)) {	//鼠标激活了物体
		--Manager.motiCount;
		Manager.PaintMouseMotivate(Manager.motiBody[Manager.motiCount]);
	} else {	//鼠标没有激活物体
		Manager.motiBody[1].Clear();
		Manager.PaintMouseMotivate(Manager.motiBody[1]);
	}
};
