"""
Kiosk Conversational Agent — handles freeform customer input using LangGraph.
Activates ONLY when customer speaks or types freeform instead of tapping UI.
Mode 1: LangGraph for agent logic, structured UI handles everything else.

State is in-memory per session. No persistence — kiosk always resets for new customer.
"""
import json
import os
from typing import TypedDict, Annotated

from engines.emi_calculator import get_emi_for_display
from engines.eligibility_engine import check_eligibility, get_income_midpoint

# LangGraph core — required
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

# langchain-groq is optional. If it (or its langchain-core transitive version)
# isn't installed, this module still loads — run_kiosk_agent returns a graceful
# fallback. Module-level decorator / class / instance uses all reference the
# stubs below so nothing explodes at import time.
try:
    from langchain_groq import ChatGroq
    from langchain_core.tools import tool
    from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
    _LANGCHAIN_GROQ_AVAILABLE = True
except Exception as _e:
    _LANGCHAIN_GROQ_AVAILABLE = False
    _IMPORT_ERROR = str(_e)

    # Stubs so @tool decorations and type references don't explode at import.
    ChatGroq = None  # type: ignore

    def tool(fn):  # type: ignore
        return fn

    class _StubMessage:  # type: ignore
        def __init__(self, *args, **kwargs):
            raise RuntimeError("langchain-groq not installed — chat is disabled")

    HumanMessage = AIMessage = ToolMessage = _StubMessage


# ── State ──────────────────────────────────────────────────────────────────────

class KioskState(TypedDict):
    messages: Annotated[list, add_messages]
    session_data: dict          # what we've collected so far (car, income, etc.)
    current_stage: str          # which kiosk stage we're on
    extracted_data: dict        # structured data extracted from conversation
    agent_response: str         # final response to show in UI / speak as Priya


# ── Tools (what the agent can call) ───────────────────────────────────────────

@tool
def search_cars_tool(query: str) -> str:
    """Search car catalog by brand, model, budget or segment."""
    import json
    from pathlib import Path
    cars = json.loads((Path(__file__).parent.parent / "data/cars.json").read_text())

    query_lower = query.lower()
    matches = [
        c for c in cars
        if query_lower in c["brand"].lower()
        or query_lower in c["model"].lower()
        or query_lower in c["segment"].lower()
        or (query_lower.isdigit() and abs(c["price"] - int(query_lower)) < 200000)
    ]

    if not matches:
        return "No cars found matching that query. Ask about budget range or brand."

    result = []
    for c in matches[:3]:
        result.append(f"{c['brand']} {c['model']} {c['variant']} — ₹{c['price']:,}")
    return "\n".join(result)


@tool
def calculate_emi_tool(principal: float, annual_rate: float, tenure_months: int) -> str:
    """Calculate EMI for given loan amount, rate, and tenure."""
    result = get_emi_for_display(principal, annual_rate, tenure_months)
    return f"EMI: ₹{result['emi']:,}/month for {tenure_months} months at {annual_rate}% p.a."


@tool
def estimate_eligibility_tool(
    income_range: str,
    employment_type: str,
    down_payment: float,
    vehicle_price: float,
    existing_emi: float = 0
) -> str:
    """Estimate loan eligibility based on customer inputs."""
    result = check_eligibility(
        income_range=income_range,
        employment_type=employment_type,
        down_payment=down_payment,
        vehicle_price=vehicle_price,
        tenure_months=60,
        cibil=700,   # assume average for estimate
        existing_emi=existing_emi,
        age=30
    )
    if result["eligible"]:
        return (
            f"Estimated eligibility: up to ₹{result['approved_amount']:,} "
            f"at ~{result['interest_rate']}%. EMI ~₹{result['emi']:,}/month. "
            f"Actual amount confirmed after PAN check."
        )
    return "Based on the information provided, eligibility is limited. Enter PAN for exact assessment."


# ── LLM Setup ─────────────────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "demo")
tools = [search_cars_tool, calculate_emi_tool, estimate_eligibility_tool]

llm = (
    ChatGroq(
        api_key=GROQ_API_KEY,
        model="llama-3.3-70b-versatile",
        temperature=0.7,
    ).bind_tools(tools)
    if (_LANGCHAIN_GROQ_AVAILABLE and GROQ_API_KEY and GROQ_API_KEY != "demo")
    else None
)


SYSTEM_PROMPT = """You are Priya, a warm and knowledgeable car loan assistant at a showroom kiosk.
Your job is to help customers explore cars and understand their loan options.

Current session data: {session_data}
Current kiosk stage: {current_stage}

Guidelines:
- Be warm, conversational, and helpful
- Extract structured information naturally (car preference, budget, income range, employment type)
- Use tools to fetch real data — never make up car names or EMI numbers
- Guide customers back to the kiosk UI for formal steps (PAN entry, form submission)
- Keep responses short — this is a kiosk, customer is standing
- If customer asks about eligibility formally, guide them to tap the UI button
"""


# ── Graph Nodes ────────────────────────────────────────────────────────────────

def agent_node(state: KioskState) -> KioskState:
    """Main agent node — LLM decides what to do next."""
    if not llm:
        return {**state, "agent_response": _demo_reply(state)}

    system = SYSTEM_PROMPT.format(
        session_data=json.dumps(state.get("session_data", {})),
        current_stage=state.get("current_stage", "unknown")
    )
    messages = [{"role": "system", "content": system}] + state["messages"]
    response = llm.invoke(messages)

    return {
        **state,
        "messages": [response],
        "agent_response": response.content if not response.tool_calls else ""
    }


def tool_node(state: KioskState) -> KioskState:
    """Execute tool calls and return results."""
    tool_map = {t.name: t for t in tools}
    last_message = state["messages"][-1]
    tool_results = []

    for call in last_message.tool_calls:
        tool_fn = tool_map.get(call["name"])
        result = tool_fn.invoke(call["args"]) if tool_fn else "Tool not found"
        tool_results.append(
            ToolMessage(content=str(result), tool_call_id=call["id"])
        )

    return {**state, "messages": tool_results}


def should_use_tools(state: KioskState) -> str:
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


# ── Build Graph ───────────────────────────────────────────────────────────────

def build_kiosk_graph():
    graph = StateGraph(KioskState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_use_tools, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


kiosk_graph = build_kiosk_graph() if _LANGCHAIN_GROQ_AVAILABLE else None


# ── Public Interface ──────────────────────────────────────────────────────────

def run_kiosk_agent(
    user_message: str,
    session_data: dict,
    current_stage: str,
    message_history: list
) -> dict:
    """
    Called by FastAPI when customer sends freeform text/voice input.
    Returns agent response and any extracted structured data.
    Returns a graceful fallback when langchain-groq isn't installed.
    """
    if not _LANGCHAIN_GROQ_AVAILABLE or kiosk_graph is None:
        return {
            "response": (
                "Hi! I'm here to help — but our live chat is being upgraded. "
                "You can continue tapping through the kiosk."
            ),
            "messages": message_history,
            "extracted_data": {},
        }

    messages = message_history + [HumanMessage(content=user_message)]

    result = kiosk_graph.invoke({
        "messages": messages,
        "session_data": session_data,
        "current_stage": current_stage,
        "extracted_data": {},
        "agent_response": ""
    })

    return {
        "response": result["agent_response"],
        "messages": result["messages"],
        "extracted_data": result.get("extracted_data", {})
    }


def _demo_reply(state: KioskState) -> str:
    """Fallback response when no API key."""
    stage = state.get("current_stage", "")
    msg = state["messages"][-1].content.lower() if state["messages"] else ""

    if "emi" in msg or "month" in msg:
        return "Based on your profile, EMI would be around ₹12,000-15,000/month. Tap 'Check Eligibility' for your exact offer!"
    if "car" in msg or "model" in msg:
        return "We have great options from Maruti, Hyundai, Tata, Honda and Toyota. What's your budget range?"
    if "budget" in msg or "afford" in msg:
        return "Let me help you find the right car! What monthly EMI are you comfortable with?"
    return "I'm here to help you find the perfect car loan. What would you like to know?"
